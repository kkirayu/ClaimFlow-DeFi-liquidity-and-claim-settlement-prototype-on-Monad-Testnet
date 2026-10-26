import { serializeCsv } from '../csv';
import type { BenchmarkReport } from './types';
import { formatDateTime, formatGas, formatLatency, formatToken } from '../format';

export function benchmarkReportToCsv(report: BenchmarkReport): string {
  return serializeCsv(
    report.samples.map((sample) => ({ ...sample, report })),
    [
      { header: 'report_id', value: (row) => row.report.id },
      { header: 'operation', value: (row) => row.report.operation },
      { header: 'workload_size', value: (row) => row.report.workloadSize },
      { header: 'batch_size', value: (row) => row.report.batchSize ?? '' },
      { header: 'chain_id', value: (row) => row.report.chainId },
      { header: 'rpc_provider', value: (row) => row.report.rpcProvider },
      { header: 'signer', value: (row) => row.report.signer },
      { header: 'sample_index', value: (row) => row.index },
      { header: 'sample_label', value: (row) => row.label },
      { header: 'status', value: (row) => row.status },
      { header: 'tx_hash', value: (row) => row.txHash ?? '' },
      {
        header: 'submitted_at',
        value: (row) => (row.submittedAt ? new Date(row.submittedAt).toISOString() : ''),
      },
      {
        header: 'latency_ms',
        value: (row) => (row.latencyMs !== undefined ? Math.round(row.latencyMs) : ''),
      },
      { header: 'gas_used', value: (row) => row.gasUsed ?? '' },
      { header: 'error', value: (row) => row.error ?? '' },
    ],
  );
}

export function benchmarkSummaryLines(report: BenchmarkReport): string[] {
  const summary = report.summary;
  return [
    `Operation: ${report.operation} (workload ${report.workloadSize})`,
    `Confirmed: ${summary.confirmed}/${summary.attempted} (${summary.successRate}%)`,
    `Median receipt latency: ${formatLatency(summary.medianLatencyMs)}`,
    `p95 receipt latency: ${summary.p95LatencyMs === null ? 'insufficient samples' : formatLatency(summary.p95LatencyMs)}`,
    `Observed throughput: ${summary.throughputTps} tx/s`,
    `Gas: total ${formatGas(summary.totalGas)}, median ${formatGas(summary.medianGas)}`,
    `Claims processed: ${summary.claimsProcessed} (${formatToken(BigInt(summary.claimsProcessed))} in count units)`,
    `Started: ${formatDateTime(Math.floor(new Date(report.startedAt).getTime() / 1000))}`,
  ];
}
