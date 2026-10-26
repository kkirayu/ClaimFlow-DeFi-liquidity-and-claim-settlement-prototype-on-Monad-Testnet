#!/usr/bin/env node
/**
 * Measure a synthetic ClaimFlow workload against a deployed network.
 *
 * Usage:
 *   node scripts/benchmark.mjs --network local --operation settle-batch --size 10 --batch 5
 *   node scripts/benchmark.mjs --network testnet --operation read --size 25 --publish
 *
 * The script sends transactions sequentially. It only measures receipt latency, gas, and observed
 * client/RPC throughput; it does not claim to measure maximum chain capacity.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  getNetwork,
  loadArtifact,
  loadEnv,
  makeClients,
  ROOT,
  readDeployment,
  waitForRpc,
} from './lib/network.mjs';
import { formatUnits } from 'viem';

const OPERATIONS = ['read', 'submit', 'settle-single', 'settle-batch'];
const METHODOLOGY =
  'Transactions were sent sequentially so latency samples are not distorted by nonce contention. Throughput is observed end-to-end client/RPC throughput, not maximum network capacity. Setup transactions are excluded from measured samples.';

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : fallback;
}

function numberArg(flag, fallback) {
  const raw = argValue(flag);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return value;
}

function randomHash() {
  return `0x${crypto.randomBytes(32).toString('hex')}`;
}

function now() {
  return Date.now();
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const position = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function summarize(samples, durationMs, claimsProcessed) {
  const successful = samples.filter((sample) => sample.status === 'success');
  const latencies = successful
    .map((sample) => sample.latencyMs)
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => a - b);
  const gas = samples
    .map((sample) => sample.gasUsed)
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => a - b);
  const durationSeconds = Math.max(durationMs / 1000, 0.001);

  return {
    attempted: samples.length,
    submitted: samples.filter((sample) => Boolean(sample.txHash)).length,
    confirmed: successful.length,
    reverted: samples.filter((sample) => sample.status === 'reverted').length,
    failed: samples.filter((sample) => sample.status === 'error').length,
    skipped: samples.filter((sample) => sample.status === 'skipped').length,
    successRate: samples.length ? round((successful.length / samples.length) * 100, 1) : 0,
    durationMs: Math.round(durationMs),
    medianLatencyMs: latencies.length ? round(percentile(latencies, 50), 2) : null,
    p95LatencyMs: latencies.length >= 5 ? round(percentile(latencies, 95), 2) : null,
    throughputTps: round(successful.length / durationSeconds, 2),
    totalGas: gas.reduce((total, value) => total + value, 0),
    medianGas: gas.length ? gas[Math.floor(gas.length / 2)] : null,
    claimsProcessed,
  };
}

async function sendMeasured({ label, index, request, walletClient, publicClient }) {
  const submittedAt = now();
  const sample = { index, label, status: 'error', submittedAt };
  try {
    const txHash = await walletClient.writeContract(request);
    sample.txHash = txHash;
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const confirmedAt = now();
    sample.confirmedAt = confirmedAt;
    sample.latencyMs = confirmedAt - submittedAt;
    sample.blockNumber = Number(receipt.blockNumber);
    sample.gasUsed = Number(receipt.gasUsed);
    sample.status = receipt.status === 'success' ? 'success' : 'reverted';
    if (receipt.status !== 'success') sample.error = 'Transaction reverted.';
  } catch (error) {
    sample.confirmedAt = now();
    sample.latencyMs = sample.confirmedAt - submittedAt;
    sample.error = error instanceof Error ? error.message : String(error);
  }
  return sample;
}

function csvSummary(report) {
  return [
    `operation,${report.operation}`,
    `chain_id,${report.chainId}`,
    `workload_size,${report.workloadSize}`,
    `batch_size,${report.batchSize ?? ''}`,
    `attempted,${report.summary.attempted}`,
    `confirmed,${report.summary.confirmed}`,
    `success_rate,${report.summary.successRate}`,
    `median_latency_ms,${report.summary.medianLatencyMs ?? ''}`,
    `p95_latency_ms,${report.summary.p95LatencyMs ?? ''}`,
    `throughput_tps,${report.summary.throughputTps}`,
    `total_gas,${report.summary.totalGas}`,
    `median_gas,${report.summary.medianGas ?? ''}`,
    `claims_processed,${report.summary.claimsProcessed}`,
  ].join('\n');
}

async function main() {
  loadEnv();
  const networkName = argValue('--network', 'local');
  const operation = argValue('--operation', 'read');
  const size = numberArg('--size', 10);
  const batchSize = numberArg('--batch', 5);
  const publish = process.argv.includes('--publish');

  if (!OPERATIONS.includes(operation)) {
    throw new Error(`--operation must be one of: ${OPERATIONS.join(', ')}`);
  }
  if (size > 100) throw new Error('--size is capped at 100 to keep demo runs short.');

  const config = getNetwork(networkName);
  const { publicClient, walletClient } = await makeClients(config);
  const signer = walletClient.account.address;
  const { deployment } = readDeployment(config.chainId);
  const { abi: managerAbi } = loadArtifact('ClaimManager');
  const { abi: vaultAbi } = loadArtifact('LiquidityVault');

  await waitForRpc(publicClient);
  const maxBatchSize = Number(
    await publicClient.readContract({
      address: deployment.contracts.claimManager,
      abi: managerAbi,
      functionName: 'maxBatchSize',
    }),
  );
  const allowSelfApproval = await publicClient.readContract({
    address: deployment.contracts.claimManager,
    abi: managerAbi,
    functionName: 'allowSelfApproval',
  });

  if (operation === 'settle-batch' && batchSize > maxBatchSize) {
    throw new Error(`--batch ${batchSize} exceeds the on-chain cap of ${maxBatchSize}.`);
  }

  const claimAmount = 1_000_000n; // 1.0 mUSDC per synthetic claim
  const requiredLiquidity = claimAmount * BigInt(size);
  const available = await publicClient.readContract({
    address: deployment.contracts.liquidityVault,
    abi: vaultAbi,
    functionName: 'availableLiquidity',
  });

  if (
    (operation === 'settle-single' || operation === 'settle-batch') &&
    available < requiredLiquidity
  ) {
    throw new Error(
      `Insufficient available liquidity: need ${formatUnits(requiredLiquidity, 6)} mUSDC, have ${formatUnits(available, 6)}. Deposit demo liquidity first.`,
    );
  }

  console.log(`\nClaimFlow benchmark`);
  console.log(`  network    ${config.networkLabel} (chain ${config.chainId})`);
  console.log(`  operation  ${operation}`);
  console.log(`  workload   ${size}${operation === 'settle-batch' ? ` (batch ${batchSize})` : ''}`);
  console.log(`  signer     ${signer}\n`);

  const setupStartedAt = now();
  let claimIds = [];
  let setupNotes = 'No setup transactions.';

  if (operation === 'settle-single' || operation === 'settle-batch') {
    console.log('Preparing synthetic claims (excluded from measurements)…');
    for (let index = 0; index < size; index += 1) {
      const claimId = randomHash();
      const submitHash = await walletClient.writeContract({
        address: deployment.contracts.claimManager,
        abi: managerAbi,
        functionName: 'submitClaim',
        args: [claimId, randomHash(), 101n, 1, signer, claimAmount, `0x${'0'.repeat(64)}`],
      });
      await publicClient.waitForTransactionReceipt({ hash: submitHash });

      if (!allowSelfApproval && deployment.roles.operator === deployment.roles.approver) {
        throw new Error(
          'Self-approval is disabled and the operator and approver addresses are the same. Configure separate role addresses for this workload.',
        );
      }

      const approveHash = await walletClient.writeContract({
        address: deployment.contracts.claimManager,
        abi: managerAbi,
        functionName: 'approveClaim',
        args: [claimId],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
      if (receipt.status !== 'success') throw new Error(`Approval reverted for ${claimId}.`);
      claimIds.push(claimId);
    }
    setupNotes = `${size} synthetic claims were submitted and approved before measurement. ${size * 2} setup transactions are excluded from the samples.`;
    console.log('Setup complete.\n');
  }

  const setupMs = now() - setupStartedAt;
  const samples = [];
  const startedAt = now();

  if (operation === 'read') {
    for (let index = 0; index < size; index += 1) {
      const sampleStartedAt = now();
      try {
        await publicClient.readContract({
          address: deployment.contracts.liquidityVault,
          abi: vaultAbi,
          functionName: 'availableLiquidity',
        });
        samples.push({
          index,
          label: `Read available liquidity ${index + 1}`,
          status: 'success',
          submittedAt: sampleStartedAt,
          confirmedAt: now(),
          latencyMs: now() - sampleStartedAt,
        });
      } catch (error) {
        samples.push({
          index,
          label: `Read available liquidity ${index + 1}`,
          status: 'error',
          submittedAt: sampleStartedAt,
          confirmedAt: now(),
          latencyMs: now() - sampleStartedAt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } else if (operation === 'submit') {
    for (let index = 0; index < size; index += 1) {
      samples.push(
        await sendMeasured({
          index,
          label: `Submit claim ${index + 1}`,
          walletClient,
          publicClient,
          request: {
            address: deployment.contracts.claimManager,
            abi: managerAbi,
            functionName: 'submitClaim',
            args: [randomHash(), randomHash(), 101n, 1, signer, claimAmount, `0x${'0'.repeat(64)}`],
          },
        }),
      );
    }
  } else if (operation === 'settle-single') {
    for (let index = 0; index < claimIds.length; index += 1) {
      samples.push(
        await sendMeasured({
          index,
          label: `Settle claim ${index + 1}`,
          walletClient,
          publicClient,
          request: {
            address: deployment.contracts.claimManager,
            abi: managerAbi,
            functionName: 'settleClaim',
            args: [claimIds[index]],
          },
        }),
      );
    }
  } else {
    for (let index = 0; index < claimIds.length; index += batchSize) {
      const chunk = claimIds.slice(index, index + batchSize);
      samples.push(
        await sendMeasured({
          index: samples.length,
          label: `Settle batch ${samples.length + 1} (${chunk.length} claims)`,
          walletClient,
          publicClient,
          request: {
            address: deployment.contracts.claimManager,
            abi: managerAbi,
            functionName: 'settleBatch',
            args: [chunk],
          },
        }),
      );
    }
  }

  const finishedAt = now();
  const durationMs = finishedAt - startedAt;
  const claimsProcessed =
    operation === 'settle-single'
      ? samples.filter((sample) => sample.status === 'success').length
      : operation === 'settle-batch'
        ? samples
            .filter((sample) => sample.status === 'success')
            .reduce((total, sample) => {
              const match = /\((\d+) claims\)/.exec(sample.label);
              return total + (match ? Number(match[1]) : 0);
            }, 0)
        : 0;

  const report = {
    version: 1,
    id: `${startedAt}-${crypto.randomBytes(4).toString('hex')}`,
    source: 'cli',
    operation,
    workloadSize: size,
    batchSize: operation === 'settle-batch' ? batchSize : null,
    chainId: config.chainId,
    chainName: config.chainName,
    rpcProvider: config.providerLabel,
    signer,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    durationMs,
    setupMs,
    setupNotes,
    samples,
    summary: summarize(samples, durationMs, claimsProcessed),
    methodology: METHODOLOGY,
  };

  const resultsDir = path.join(ROOT, 'benchmark-results');
  fs.mkdirSync(resultsDir, { recursive: true });
  const stamp = new Date(startedAt).toISOString().replace(/[:.]/g, '-');
  const outFile = path.resolve(
    ROOT,
    argValue('--out', path.join('benchmark-results', `${operation}-${stamp}.json`)),
  );
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outFile.replace(/\.json$/, '.csv'), `${csvSummary(report)}\n`);

  console.log('Results');
  console.log(`  confirmed          ${report.summary.confirmed}/${report.summary.attempted}`);
  console.log(`  median latency     ${report.summary.medianLatencyMs ?? '—'} ms`);
  console.log(`  p95 latency        ${report.summary.p95LatencyMs ?? 'insufficient samples'} ms`);
  console.log(`  throughput         ${report.summary.throughputTps} tx/s`);
  console.log(`  total gas          ${report.summary.totalGas}`);
  console.log(`  report             ${outFile}`);

  if (publish) {
    const publicFile = path.join(ROOT, 'frontend', 'public', 'benchmark', 'latest.json');
    fs.mkdirSync(path.dirname(publicFile), { recursive: true });
    fs.writeFileSync(publicFile, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`  published          ${publicFile}`);
  }
}

main().catch((error) => {
  console.error(`\nBenchmark failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
