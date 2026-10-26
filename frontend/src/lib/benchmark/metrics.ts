import type {
  BenchmarkOperation,
  BenchmarkReport,
  BenchmarkSample,
  BenchmarkSummary,
} from './types';
import { METHODOLOGY_NOTE } from './types';

export function percentile(sortedValues: number[], p: number): number | null {
  if (sortedValues.length === 0) return null;
  if (sortedValues.length === 1) return sortedValues[0] ?? null;
  const clamped = Math.min(100, Math.max(0, p));
  const position = ((clamped / 100) * (sortedValues.length - 1)) as number;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sortedValues[lowerIndex];
  const upper = sortedValues[upperIndex];
  if (lower === undefined || upper === undefined) return null;
  if (lowerIndex === upperIndex) return lower;
  const weight = position - lowerIndex;
  return lower + (upper - lower) * weight;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const a = sorted[middle - 1];
  const b = sorted[middle];
  if (a === undefined || b === undefined) return null;
  return (a + b) / 2;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function summarizeSamples(
  samples: BenchmarkSample[],
  durationMs: number,
  claimsProcessed: number,
): BenchmarkSummary {
  const successful = samples.filter((sample) => sample.status === 'success');
  const submitted = samples.filter((sample) => Boolean(sample.txHash));
  const latencies = successful
    .map((sample) => sample.latencyMs)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => a - b);
  const gasValues = samples
    .map((sample) => sample.gasUsed)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  const attempted = samples.length;
  const successRate = attempted === 0 ? 0 : (successful.length / attempted) * 100;
  const durationSeconds = Math.max(durationMs / 1000, 0.001);

  return {
    attempted,
    submitted: submitted.length,
    confirmed: successful.length,
    reverted: samples.filter((sample) => sample.status === 'reverted').length,
    failed: samples.filter((sample) => sample.status === 'error').length,
    skipped: samples.filter((sample) => sample.status === 'skipped').length,
    successRate: round(successRate, 1),
    durationMs: Math.round(durationMs),
    medianLatencyMs: latencies.length ? round(percentile(latencies, 50) ?? 0) : null,
    p95LatencyMs: latencies.length >= 5 ? round(percentile(latencies, 95) ?? 0) : null,
    throughputTps: round(successful.length / durationSeconds, 2),
    totalGas: gasValues.reduce((total, gas) => total + gas, 0),
    medianGas: median(gasValues),
    claimsProcessed,
  };
}

export function buildReport(params: {
  operation: BenchmarkOperation;
  workloadSize: number;
  batchSize: number | null;
  chainId: number;
  chainName: string;
  rpcProvider: string;
  signer: string;
  startedAt: number;
  finishedAt: number;
  setupMs: number;
  setupNotes: string;
  samples: BenchmarkSample[];
  claimsProcessed: number;
  source: 'browser' | 'cli';
  id?: string;
}): BenchmarkReport {
  const durationMs = Math.max(0, params.finishedAt - params.startedAt);
  return {
    version: 1,
    id: params.id ?? `${params.startedAt}-${Math.random().toString(36).slice(2, 8)}`,
    source: params.source,
    operation: params.operation,
    workloadSize: params.workloadSize,
    batchSize: params.batchSize,
    chainId: params.chainId,
    chainName: params.chainName,
    rpcProvider: params.rpcProvider,
    signer: params.signer,
    startedAt: new Date(params.startedAt).toISOString(),
    finishedAt: new Date(params.finishedAt).toISOString(),
    durationMs: Math.round(durationMs),
    setupMs: Math.round(params.setupMs),
    setupNotes: params.setupNotes,
    samples: params.samples,
    summary: summarizeSamples(params.samples, durationMs, params.claimsProcessed),
    methodology: METHODOLOGY_NOTE,
  };
}

export function isBenchmarkReport(value: unknown): value is BenchmarkReport {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BenchmarkReport>;
  return (
    candidate.version === 1 &&
    typeof candidate.id === 'string' &&
    typeof candidate.operation === 'string' &&
    Array.isArray(candidate.samples) &&
    typeof candidate.summary === 'object' &&
    candidate.summary !== null
  );
}
