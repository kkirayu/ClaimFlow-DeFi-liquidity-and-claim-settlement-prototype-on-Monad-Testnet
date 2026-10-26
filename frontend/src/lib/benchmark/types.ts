export type BenchmarkOperation = 'read' | 'submit' | 'settle-single' | 'settle-batch';

export type BenchmarkSampleStatus = 'success' | 'reverted' | 'error' | 'skipped';

export interface BenchmarkSample {
  index: number;
  label: string;
  status: BenchmarkSampleStatus;
  txHash?: string;
  submittedAt?: number;
  confirmedAt?: number;
  latencyMs?: number;
  gasUsed?: number;
  blockNumber?: number;
  error?: string;
}

export interface BenchmarkSummary {
  attempted: number;
  submitted: number;
  confirmed: number;
  reverted: number;
  failed: number;
  skipped: number;
  successRate: number;
  durationMs: number;
  medianLatencyMs: number | null;
  p95LatencyMs: number | null;
  throughputTps: number;
  totalGas: number;
  medianGas: number | null;
  claimsProcessed: number;
}

export interface BenchmarkReport {
  version: 1;
  id: string;
  source: 'browser' | 'cli';
  operation: BenchmarkOperation;
  workloadSize: number;
  batchSize: number | null;
  chainId: number;
  chainName: string;
  rpcProvider: string;
  signer: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  setupMs: number;
  setupNotes: string;
  samples: BenchmarkSample[];
  summary: BenchmarkSummary;
  methodology: string;
}

export const OPERATION_LABELS: Record<BenchmarkOperation, string> = {
  read: 'Read-only calls',
  submit: 'Independent claim submissions',
  'settle-single': 'Sequential single settlements',
  'settle-batch': 'Batch settlements',
};

export const METHODOLOGY_NOTE =
  'These results describe only the workload, RPC provider, signer, and time window shown. Transactions were sent sequentially so latency samples are not distorted by nonce contention. Throughput is observed end-to-end client/RPC throughput, not maximum network capacity.';
