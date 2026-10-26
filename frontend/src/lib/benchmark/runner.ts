import type { Address, Hex, PublicClient, WalletClient } from 'viem';
import { formatUnits } from 'viem';
import { chain, CHAIN_ID, NETWORK_LABEL, PROVIDER_LABEL } from '../chain';
import { contracts, TOKEN_DECIMALS } from '../contracts';
import { describeError } from '../errors';
import { buildReport } from './metrics';
import type { BenchmarkOperation, BenchmarkReport, BenchmarkSample } from './types';

export const BENCHMARK_CLAIM_AMOUNT = 1_000_000n; // 1.00 mUSDC
export const BENCHMARK_PRESETS = [10, 25, 50] as const;
export const BATCH_PRESETS = [2, 5, 10] as const;

export interface BenchmarkProgress {
  samples: BenchmarkSample[];
  report: BenchmarkReport | null;
  phase: 'preparing' | 'measuring' | 'done' | 'cancelled' | 'failed';
  message: string;
}

export interface BenchmarkRunParams {
  operation: BenchmarkOperation;
  workloadSize: number;
  batchSize: number;
  publicClient: PublicClient;
  walletClient?: WalletClient;
  signer?: Address;
  shouldCancel: () => boolean;
  onProgress: (progress: BenchmarkProgress) => void;
}

function randomHash(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

function round(value: number): number {
  return Math.round(value);
}

function makeSample(index: number, label: string): BenchmarkSample {
  return { index, label, status: 'skipped' };
}

async function timedRead<T>(read: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const started = performance.now();
  const value = await read();
  return { value, latencyMs: performance.now() - started };
}

export async function runBenchmark(params: BenchmarkRunParams): Promise<BenchmarkReport> {
  const { operation, workloadSize, batchSize, publicClient, walletClient, signer } = params;
  if (!contracts.manager || !contracts.vault || !contracts.token) {
    throw new Error('ClaimFlow contracts are not configured.');
  }

  if (operation !== 'read' && (!walletClient || !signer)) {
    throw new Error('Connect a wallet on the configured network to run transaction workloads.');
  }

  const manager = contracts.manager;
  const vault = contracts.vault;

  const sampleCount =
    operation === 'settle-batch' ? Math.ceil(workloadSize / batchSize) : workloadSize;
  const labels =
    operation === 'settle-batch'
      ? Array.from({ length: sampleCount }, (_, index) => {
          const start = index * batchSize + 1;
          const end = Math.min(workloadSize, (index + 1) * batchSize);
          return `Batch ${index + 1} · claims ${start}-${end}`;
        })
      : Array.from({ length: sampleCount }, (_, index) => {
          switch (operation) {
            case 'read':
              return `Read ${index + 1}/${workloadSize}`;
            case 'submit':
              return `Claim ${index + 1}/${workloadSize}`;
            default:
              return `Settlement ${index + 1}/${workloadSize}`;
          }
        });

  const samples = labels.map((label, index) => makeSample(index, label));
  const emit = (
    phase: BenchmarkProgress['phase'],
    message: string,
    report: BenchmarkReport | null = null,
  ) => {
    params.onProgress({
      samples: samples.map((sample) => ({ ...sample })),
      report,
      phase,
      message,
    });
  };

  const setupStart = performance.now();
  let setupMs = 0;
  let setupNotes = 'No setup transactions required.';
  let claimIds: Hex[] = [];
  let claimsProcessed = 0;

  try {
    if (operation === 'settle-single' || operation === 'settle-batch') {
      emit('preparing', 'Submitting and approving synthetic claims for settlement setup…');
      if (!walletClient || !signer) throw new Error('A signer is required.');
      if (operation === 'settle-batch' && (batchSize < 1 || batchSize > 50)) {
        throw new Error('Batch size must be between 1 and 50.');
      }

      const allowSelf = await publicClient.readContract({
        ...manager,
        functionName: 'allowSelfApproval',
      });
      if (!allowSelf) {
        throw new Error(
          'This deployment requires a different approver and creator. The in-app benchmark uses one signer, so the demo deployment must enable self-approval or the workload must be run with separate accounts.',
        );
      }

      const available = await publicClient.readContract({
        ...vault,
        functionName: 'availableLiquidity',
      });
      const required = BENCHMARK_CLAIM_AMOUNT * BigInt(workloadSize);
      if (available < required) {
        throw new Error(
          `Available liquidity is ${formatUnits(available, TOKEN_DECIMALS)} mUSDC but the workload needs ${formatUnits(required, TOKEN_DECIMALS)} mUSDC. Deposit more liquidity or lower the workload.`,
        );
      }

      claimIds = [];
      for (let index = 0; index < workloadSize; index++) {
        if (params.shouldCancel()) {
          emit(
            'cancelled',
            'Benchmark cancelled during setup. No measured samples were collected.',
          );
          setupMs = performance.now() - setupStart;
          const now = Date.now();
          return buildReport({
            operation,
            workloadSize,
            batchSize: operation === 'settle-batch' ? batchSize : null,
            chainId: CHAIN_ID,
            chainName: NETWORK_LABEL,
            rpcProvider: PROVIDER_LABEL,
            signer: signer ?? 'read-only',
            startedAt: now,
            finishedAt: now,
            setupMs,
            setupNotes: 'Cancelled during setup.',
            samples,
            claimsProcessed: 0,
            source: 'browser',
          });
        }

        const claimId = randomHash();
        await sendAndConfirm(publicClient, walletClient, {
          ...manager,
          functionName: 'submitClaim',
          args: [
            claimId,
            randomHash(),
            900 + (index % 10),
            8,
            signer,
            BENCHMARK_CLAIM_AMOUNT,
            `0x${'0'.repeat(64)}`,
          ],
          chain,
          account: signer,
        });
        await sendAndConfirm(publicClient, walletClient, {
          ...manager,
          functionName: 'approveClaim',
          args: [claimId],
          chain,
          account: signer,
        });
        claimIds.push(claimId);
      }
      setupMs = performance.now() - setupStart;
      setupNotes = `${workloadSize} synthetic claims submitted and approved sequentially. These ${workloadSize * 2} setup transactions are excluded from the measured samples.`;
    }
  } catch (error) {
    setupMs = performance.now() - setupStart;
    throw new Error(describeError(error).message);
  }

  const startedAt = Date.now();
  emit('measuring', 'Measuring sequential requests. Cancel stops unsent work only.');

  try {
    if (operation === 'read') {
      for (let index = 0; index < workloadSize; index++) {
        if (params.shouldCancel()) break;
        const sample = samples[index];
        if (!sample) continue;
        sample.submittedAt = Date.now();
        try {
          if (index % 3 === 0) {
            const result = await timedRead(() =>
              publicClient.readContract({ ...vault, functionName: 'totalAssets' }),
            );
            void result.value;
            sample.latencyMs = result.latencyMs;
          } else if (index % 3 === 1) {
            const result = await timedRead(() =>
              publicClient.readContract({ ...vault, functionName: 'availableLiquidity' }),
            );
            void result.value;
            sample.latencyMs = result.latencyMs;
          } else {
            const result = await timedRead(() =>
              publicClient.readContract({ ...manager, functionName: 'claimCount' }),
            );
            void result.value;
            sample.latencyMs = result.latencyMs;
          }
          sample.confirmedAt = Date.now();
          sample.latencyMs = sample.confirmedAt - sample.submittedAt;
          sample.status = 'success';
        } catch (error) {
          sample.confirmedAt = Date.now();
          sample.status = 'error';
          sample.error = describeError(error).message;
        }
        emit('measuring', `Completed ${index + 1} of ${workloadSize} read calls.`);
      }
    } else if (operation === 'submit') {
      if (!walletClient || !signer) throw new Error('A signer is required.');
      for (let index = 0; index < workloadSize; index++) {
        if (params.shouldCancel()) break;
        const sample = samples[index];
        if (!sample) continue;
        const claimId = randomHash();
        sample.submittedAt = Date.now();
        try {
          const hash = await walletClient.writeContract({
            ...manager,
            functionName: 'submitClaim',
            args: [
              claimId,
              randomHash(),
              900 + (index % 10),
              8,
              signer,
              BENCHMARK_CLAIM_AMOUNT,
              `0x${'0'.repeat(64)}`,
            ],
            chain,
            account: signer,
          });
          sample.txHash = hash;
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          sample.confirmedAt = Date.now();
          sample.latencyMs = sample.confirmedAt - sample.submittedAt;
          sample.gasUsed = Number(receipt.gasUsed);
          sample.blockNumber = Number(receipt.blockNumber);
          sample.status = receipt.status === 'success' ? 'success' : 'reverted';
        } catch (error) {
          sample.confirmedAt = Date.now();
          sample.status = 'error';
          sample.error = describeError(error).message;
        }
        emit('measuring', `Completed ${index + 1} of ${workloadSize} claim submissions.`);
      }
    } else if (operation === 'settle-single') {
      if (!walletClient || !signer) throw new Error('A signer is required.');
      for (let index = 0; index < claimIds.length; index++) {
        if (params.shouldCancel()) break;
        const sample = samples[index];
        const claimId = claimIds[index];
        if (!sample || !claimId) continue;
        sample.submittedAt = Date.now();
        try {
          const hash = await walletClient.writeContract({
            ...manager,
            functionName: 'settleClaim',
            args: [claimId],
            chain,
            account: signer,
          });
          sample.txHash = hash;
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          sample.confirmedAt = Date.now();
          sample.latencyMs = sample.confirmedAt - sample.submittedAt;
          sample.gasUsed = Number(receipt.gasUsed);
          sample.blockNumber = Number(receipt.blockNumber);
          sample.status = receipt.status === 'success' ? 'success' : 'reverted';
          if (sample.status === 'success') claimsProcessed += 1;
        } catch (error) {
          sample.confirmedAt = Date.now();
          sample.status = 'error';
          sample.error = describeError(error).message;
        }
        emit('measuring', `Completed ${index + 1} of ${claimIds.length} settlements.`);
      }
    } else {
      if (!walletClient || !signer) throw new Error('A signer is required.');
      for (let index = 0; index < sampleCount; index++) {
        if (params.shouldCancel()) break;
        const sample = samples[index];
        if (!sample) continue;
        const start = index * batchSize;
        const chunk = claimIds.slice(start, start + batchSize);
        if (chunk.length === 0) continue;
        sample.submittedAt = Date.now();
        try {
          const hash = await walletClient.writeContract({
            ...manager,
            functionName: 'settleBatch',
            args: [chunk],
            chain,
            account: signer,
          });
          sample.txHash = hash;
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          sample.confirmedAt = Date.now();
          sample.latencyMs = sample.confirmedAt - sample.submittedAt;
          sample.gasUsed = Number(receipt.gasUsed);
          sample.blockNumber = Number(receipt.blockNumber);
          sample.status = receipt.status === 'success' ? 'success' : 'reverted';
          if (sample.status === 'success') claimsProcessed += chunk.length;
        } catch (error) {
          sample.confirmedAt = Date.now();
          sample.status = 'error';
          sample.error = describeError(error).message;
        }
        emit('measuring', `Completed ${index + 1} of ${sampleCount} batch settlements.`);
      }
    }
  } catch (error) {
    const finishedAt = Date.now();
    const report = buildReport({
      operation,
      workloadSize,
      batchSize: operation === 'settle-batch' ? batchSize : null,
      chainId: CHAIN_ID,
      chainName: NETWORK_LABEL,
      rpcProvider: PROVIDER_LABEL,
      signer: signer ?? 'read-only',
      startedAt,
      finishedAt,
      setupMs,
      setupNotes,
      samples,
      claimsProcessed,
      source: 'browser',
    });
    emit('failed', describeError(error).message, report);
    return report;
  }

  const finishedAt = Date.now();
  const cancelled = samples.some((sample) => sample.status === 'skipped');
  const report = buildReport({
    operation,
    workloadSize,
    batchSize: operation === 'settle-batch' ? batchSize : null,
    chainId: CHAIN_ID,
    chainName: NETWORK_LABEL,
    rpcProvider: PROVIDER_LABEL,
    signer: signer ?? 'read-only',
    startedAt,
    finishedAt,
    setupMs,
    setupNotes,
    samples,
    claimsProcessed,
    source: 'browser',
  });
  emit(
    cancelled ? 'cancelled' : 'done',
    cancelled
      ? 'Benchmark stopped. Unsent requests were skipped; sent transactions were not cancelled.'
      : 'Benchmark completed. Results reflect this workload only.',
    report,
  );
  return report;
}

async function sendAndConfirm(
  publicClient: PublicClient,
  walletClient: WalletClient,
  request: Record<string, unknown>,
) {
  const hash = await walletClient.writeContract(request as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`Setup transaction ${hash} reverted.`);
  return receipt;
}

export function benchmarkAmountLabel(workloadSize: number): string {
  return `${formatUnits(BENCHMARK_CLAIM_AMOUNT * BigInt(workloadSize), TOKEN_DECIMALS)} mUSDC`;
}

export { round };
