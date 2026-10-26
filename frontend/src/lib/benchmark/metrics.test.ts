import { describe, expect, it } from 'vitest';
import { buildReport, isBenchmarkReport, median, percentile, summarizeSamples } from './metrics';
import type { BenchmarkSample } from './types';

function sample(overrides: Partial<BenchmarkSample> = {}): BenchmarkSample {
  return {
    index: 0,
    label: 'sample',
    status: 'success',
    latencyMs: 100,
    ...overrides,
  };
}

describe('percentile', () => {
  it('returns null for an empty series and handles single values', () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([42], 95)).toBe(42);
  });

  it('interpolates between sorted values', () => {
    expect(percentile([10, 20, 30, 40, 50], 50)).toBe(30);
    expect(percentile([10, 20, 30, 40, 50], 95)).toBe(48);
    expect(percentile([1, 2], 0)).toBe(1);
    expect(percentile([1, 2], 100)).toBe(2);
  });
});

describe('median', () => {
  it('handles even and odd lengths without mutating input', () => {
    const values = [5, 1, 3, 2, 4];
    expect(median(values)).toBe(3);
    expect(values).toEqual([5, 1, 3, 2, 4]);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('summarizeSamples', () => {
  it('counts outcomes, latency, gas, and throughput', () => {
    const samples: BenchmarkSample[] = [
      sample({ index: 0, latencyMs: 100, gasUsed: 40_000, txHash: `0x${'11'.repeat(32)}` }),
      sample({ index: 1, latencyMs: 200, gasUsed: 60_000, txHash: `0x${'22'.repeat(32)}` }),
      sample({ index: 2, status: 'reverted', latencyMs: 300, txHash: `0x${'33'.repeat(32)}` }),
      sample({ index: 3, status: 'error' }),
      sample({ index: 4, status: 'skipped' }),
    ];
    const summary = summarizeSamples(samples, 2_000, 3);

    expect(summary.attempted).toBe(5);
    expect(summary.submitted).toBe(3);
    expect(summary.confirmed).toBe(2);
    expect(summary.reverted).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.successRate).toBe(40);
    expect(summary.medianLatencyMs).toBe(150);
    expect(summary.p95LatencyMs).toBeNull();
    expect(summary.throughputTps).toBe(1);
    expect(summary.totalGas).toBe(100_000);
    expect(summary.medianGas).toBe(50_000);
    expect(summary.claimsProcessed).toBe(3);
  });

  it('reports no p95 when there are fewer than five successful samples', () => {
    const summary = summarizeSamples([sample(), sample({ index: 1 })], 1_000, 0);
    expect(summary.p95LatencyMs).toBeNull();
    expect(summary.successRate).toBe(100);
  });

  it('interpolates p95 when there are at least five successful samples', () => {
    const latencies = [10, 20, 30, 40, 50];
    const summary = summarizeSamples(
      latencies.map((latencyMs, index) => sample({ index, latencyMs })),
      1_000,
      0,
    );
    expect(summary.p95LatencyMs).toBe(48);
    expect(summary.medianLatencyMs).toBe(30);
  });

  it('does not divide by zero on an empty run', () => {
    const summary = summarizeSamples([], 0, 0);
    expect(summary).toMatchObject({
      attempted: 0,
      confirmed: 0,
      successRate: 0,
      medianLatencyMs: null,
      medianGas: null,
      throughputTps: 0,
    });
  });
});

describe('buildReport', () => {
  const samples = [sample({ index: 0, latencyMs: 120 })];

  it('builds a versioned report with ISO timestamps and a summary', () => {
    const report = buildReport({
      operation: 'settle-batch',
      workloadSize: 10,
      batchSize: 5,
      chainId: 31337,
      chainName: 'Anvil Local',
      rpcProvider: 'Local Anvil RPC',
      signer: '0x1111111111111111111111111111111111111111',
      startedAt: 1_700_000_000_000,
      finishedAt: 1_700_000_002_500,
      setupMs: 900,
      setupNotes: 'prepared claims',
      samples,
      claimsProcessed: 5,
      source: 'browser',
      id: 'fixed-id',
    });

    expect(report.version).toBe(1);
    expect(report.id).toBe('fixed-id');
    expect(report.durationMs).toBe(2_500);
    expect(report.startedAt).toBe('2023-11-14T22:13:20.000Z');
    expect(report.finishedAt).toBe('2023-11-14T22:13:22.500Z');
    expect(report.summary.claimsProcessed).toBe(5);
    expect(report.methodology).toContain('sequentially');
    expect(report.setupMs).toBe(900);
  });

  it('accepts valid reports and rejects malformed values', () => {
    const report = buildReport({
      operation: 'read',
      workloadSize: 1,
      batchSize: null,
      chainId: 31337,
      chainName: 'Anvil Local',
      rpcProvider: 'Local Anvil RPC',
      signer: '0x1111111111111111111111111111111111111111',
      startedAt: 1_700_000_000_000,
      finishedAt: 1_700_000_000_500,
      setupMs: 0,
      setupNotes: 'none',
      samples,
      claimsProcessed: 0,
      source: 'cli',
    });
    expect(isBenchmarkReport(report)).toBe(true);
    expect(isBenchmarkReport({ version: 1 })).toBe(false);
    expect(isBenchmarkReport(null)).toBe(false);
    expect(isBenchmarkReport({ ...report, version: 2 })).toBe(false);
    expect(isBenchmarkReport({ ...report, samples: 'nope' })).toBe(false);
  });
});
