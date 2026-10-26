import { describe, expect, it } from 'vitest';
import { buildReport } from './metrics';
import { benchmarkReportToCsv, benchmarkSummaryLines } from './csv';

function report() {
  return buildReport({
    operation: 'settle-single',
    workloadSize: 2,
    batchSize: null,
    chainId: 10143,
    chainName: 'Monad Testnet',
    rpcProvider: 'RPC provider',
    signer: '0x1111111111111111111111111111111111111111',
    startedAt: 1_700_000_000_000,
    finishedAt: 1_700_000_002_000,
    setupMs: 500,
    setupNotes: 'prepared',
    claimsProcessed: 1,
    source: 'cli',
    id: 'report-1',
    samples: [
      {
        index: 0,
        label: 'Settle claim 1',
        status: 'success',
        txHash: `0x${'aa'.repeat(32)}`,
        submittedAt: 1_700_000_000_000,
        latencyMs: 450.6,
        gasUsed: 88_000,
      },
      {
        index: 1,
        label: 'Settle claim 2',
        status: 'error',
        error: 'reverted, with comma',
      },
    ],
  });
}

describe('benchmarkReportToCsv', () => {
  it('includes environment, sample, and metric columns', () => {
    const csv = benchmarkReportToCsv(report());
    const [header, first, second] = csv.split('\n');
    expect(header).toContain('report_id,operation,workload_size,batch_size');
    expect(header).toContain('latency_ms,gas_used,error');
    expect(first).toContain('report-1,settle-single,2,,10143');
    expect(first).toContain('Settle claim 1,success');
    expect(first).toContain(',451,88000,');
    expect(second).toContain('"reverted, with comma"');
  });
});

describe('benchmarkSummaryLines', () => {
  it('renders human-readable summary metrics', () => {
    const lines = benchmarkSummaryLines(report());
    const text = lines.join('\n');
    expect(text).toContain('Operation: settle-single (workload 2)');
    expect(text).toContain('Confirmed: 1/2 (50%)');
    expect(text).toContain('Median receipt latency: 451 ms');
    expect(text).toContain('Claims processed: 1');
  });
});
