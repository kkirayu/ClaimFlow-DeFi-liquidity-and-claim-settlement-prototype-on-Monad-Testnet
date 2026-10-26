import { useMemo, useRef, useState } from 'react';
import { useConnection, useWalletClient } from 'wagmi';
import {
  AlertTriangle,
  Ban,
  Download,
  FileJson,
  FlaskConical,
  Play,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, InlineNotice, Skeleton } from '@/components/ui/Feedback';
import { Field, Select } from '@/components/ui/Input';
import { BenchmarkMetric } from './BenchmarkMetric';
import { LatencyChart, ComparisonChart } from './LatencyChart';
import { SampleTable } from './SampleTable';
import { usePoolSnapshot, useRoles } from '@/hooks/useProtocol';
import { useBenchmarkReports } from '@/hooks/useBenchmarkReports';
import { useTransaction } from '@/components/transactions/TransactionProvider';
import { publicClient, CHAIN_ID, NETWORK_LABEL, PROVIDER_LABEL } from '@/lib/chain';
import { TOKEN_SYMBOL } from '@/lib/contracts';
import {
  BENCHMARK_CLAIM_AMOUNT,
  BENCHMARK_PRESETS,
  BATCH_PRESETS,
  benchmarkAmountLabel,
  runBenchmark,
  type BenchmarkProgress,
} from '@/lib/benchmark/runner';
import { OPERATION_LABELS, METHODOLOGY_NOTE, type BenchmarkOperation } from '@/lib/benchmark/types';
import { benchmarkReportToCsv } from '@/lib/benchmark/csv';
import { downloadTextFile } from '@/lib/csv';
import {
  formatDateTime,
  formatDuration,
  formatGas,
  formatInteger,
  formatLatency,
  formatRate,
  formatToken,
  shortAddress,
} from '@/lib/format';
import { describeError } from '@/lib/errors';
import { cn } from '@/lib/cn';

const OPERATION_DESCRIPTIONS: Record<BenchmarkOperation, string> = {
  read: 'Sequential read-only calls against vault balances and the claim counter. No wallet, signature, or gas is required.',
  submit:
    'Independent synthetic claim submissions. Each transaction records opaque metadata only; no approval or payout is performed.',
  'settle-single':
    'Prepares approved claims first, then measures sequential single-claim settlement transactions.',
  'settle-batch':
    'Prepares approved claims first, then measures all-or-nothing batch settlement transactions.',
};

const PHASE_TONE = {
  preparing: 'warning',
  measuring: 'primary',
  done: 'success',
  cancelled: 'neutral',
  failed: 'danger',
} as const;

export function BenchmarkPage() {
  const { address, isConnected, chainId } = useConnection();
  const { data: walletClient } = useWalletClient();
  const pool = usePoolSnapshot();
  const roles = useRoles(address);
  const { isBusy: walletBusy } = useTransaction();
  const { allReports, committedLoading, save, clear, reports } = useBenchmarkReports();

  const [operation, setOperation] = useState<BenchmarkOperation>('read');
  const [workload, setWorkload] = useState<(typeof BENCHMARK_PRESETS)[number]>(10);
  const [batchChoice, setBatchChoice] = useState(5);
  const [progress, setProgress] = useState<BenchmarkProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cancelRequested = useRef(false);

  const settlementOperation = operation === 'settle-single' || operation === 'settle-batch';
  const requiredLiquidity = BENCHMARK_CLAIM_AMOUNT * BigInt(workload);
  const maxBatch = pool.data ? Number(pool.data.maxBatchSize) : 10;
  const batchOptions = useMemo(() => {
    const sizes: number[] = BATCH_PRESETS.filter((size) => size <= maxBatch);
    if (maxBatch <= 10 && !sizes.includes(maxBatch)) sizes.push(maxBatch);
    const unique = [...new Set(sizes)].sort((a, b) => a - b);
    return unique.length > 0 ? unique : [1];
  }, [maxBatch]);
  const batchSize = batchOptions.includes(batchChoice) ? batchChoice : (batchOptions[0] ?? 1);

  const startDisabledReason = (() => {
    if (isRunning) return 'A workload is already running.';
    if (walletBusy) return 'Wait for the current wallet transaction to finish.';
    if (operation === 'read') return undefined;
    if (!isConnected) return 'Connect a wallet on the configured network.';
    if (chainId !== CHAIN_ID) return `Switch your wallet to chain ${CHAIN_ID}.`;
    if (!walletClient) return 'Wallet client is not ready yet.';
    if (operation === 'submit' && !roles.data) return 'Checking wallet roles…';
    if (operation === 'submit' && !roles.data?.isOperator)
      return 'Claim Operator role is required to submit claims.';
    if (settlementOperation && !roles.data) return 'Checking wallet roles…';
    if (settlementOperation && !roles.data?.isSettler)
      return 'Settlement Operator role is required for settlement workloads.';
    if (settlementOperation && !pool.data) return 'Loading deployment safety settings…';
    if (settlementOperation && pool.data && !pool.data.allowSelfApproval)
      return 'Self-approval is disabled on this deployment. The single-signer benchmark cannot prepare approved claims.';
    if (settlementOperation && pool.data && pool.data.available < requiredLiquidity)
      return `Available liquidity is ${formatToken(pool.data.available)} ${TOKEN_SYMBOL}; the workload needs ${benchmarkAmountLabel(workload)}.`;
    return undefined;
  })();

  const reportFromHistory = allReports.find((item) => item.id === selectedId);
  const report = reportFromHistory ?? progress?.report ?? allReports[0] ?? null;
  const reportOptions =
    report && !allReports.some((item) => item.id === report.id)
      ? [report, ...allReports]
      : allReports;

  const start = async () => {
    if (startDisabledReason) return;
    setRunError(null);
    setCancelling(false);
    cancelRequested.current = false;
    setIsRunning(true);
    setProgress({
      samples: [],
      report: null,
      phase: 'preparing',
      message: 'Preparing the synthetic workload…',
    });

    try {
      const result = await runBenchmark({
        operation,
        workloadSize: workload,
        batchSize,
        publicClient,
        walletClient: walletClient ?? undefined,
        signer: address,
        shouldCancel: () => cancelRequested.current,
        onProgress: setProgress,
      });
      save(result);
      setSelectedId(result.id);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : describeError(error).message);
      setProgress(null);
    } finally {
      setIsRunning(false);
      setCancelling(false);
    }
  };

  const cancel = () => {
    cancelRequested.current = true;
    setCancelling(true);
  };

  const completedSamples = progress
    ? progress.samples.filter((sample) => sample.status !== 'skipped').length
    : 0;
  const progressPercent =
    progress && progress.samples.length > 0
      ? Math.round((completedSamples / progress.samples.length) * 100)
      : 0;

  const exportJson = () => {
    if (!report) return;
    downloadTextFile(
      `claimflow-benchmark-${report.id}.json`,
      `${JSON.stringify(report, null, 2)}\n`,
      'application/json',
    );
  };

  const exportCsv = () => {
    if (!report) return;
    downloadTextFile(
      `claimflow-benchmark-${report.id}.csv`,
      benchmarkReportToCsv(report),
      'text/csv',
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Performance Lab"
        description="Run an explicit synthetic workload and record measured latency, gas, success rate, and observed throughput. Results never claim network maximum capacity."
        actions={
          <Badge tone="info" icon={<FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />}>
            {NETWORK_LABEL}
          </Badge>
        }
      />

      <Card>
        <CardHeader
          title="Workload configuration"
          description="Transactions run sequentially so nonce contention does not distort latency samples. Cancellation stops unsent work only."
          action={
            isRunning ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={cancel}
                disabled={cancelling}
              >
                <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                {cancelling ? 'Stopping…' : 'Cancel run'}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => void start()}
                disabled={Boolean(startDisabledReason)}
                title={startDisabledReason}
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                Start workload
              </Button>
            )
          }
        />

        <CardContent className="space-y-5 pt-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Field
              label="Operation"
              htmlFor="benchmark-operation"
              hint={OPERATION_DESCRIPTIONS[operation]}
            >
              <Select
                id="benchmark-operation"
                value={operation}
                onChange={(event) => setOperation(event.target.value as BenchmarkOperation)}
                disabled={isRunning}
              >
                {Object.entries(OPERATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Workload size" hint="Sequential samples per run.">
                <div className="flex flex-wrap gap-2">
                  {BENCHMARK_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      size="sm"
                      variant={workload === preset ? 'primary' : 'outline'}
                      onClick={() => setWorkload(preset)}
                      disabled={isRunning}
                      className="tabular min-w-[52px]"
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </Field>

              {operation === 'settle-batch' ? (
                <Field
                  label="Batch size"
                  htmlFor="benchmark-batch"
                  hint="Bounded by the contract cap."
                >
                  <Select
                    id="benchmark-batch"
                    value={String(batchSize)}
                    onChange={(event) => setBatchChoice(Number(event.target.value))}
                    disabled={isRunning}
                  >
                    {batchOptions.map((size) => (
                      <option key={size} value={size}>
                        {size} claims / batch
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <div className="rounded-card border-border bg-surface-muted/40 border px-3 py-3">
                  <p className="text-ink-muted text-[11px] font-medium">Workload units</p>
                  <p className="tabular text-ink-primary mt-1 text-sm font-semibold">
                    {operation.startsWith('settle') ? 'claims' : 'requests'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-card border-border bg-surface-muted/40 flex flex-wrap items-center gap-2 border px-4 py-3">
            <Badge tone="neutral">Chain {CHAIN_ID}</Badge>
            <Badge tone="neutral">{PROVIDER_LABEL}</Badge>
            <Badge tone={address ? 'primary' : 'neutral'}>
              Signer {address ? shortAddress(address) : 'read-only'}
            </Badge>
            <span className="text-ink-muted ml-auto text-[11px]">
              {settlementOperation
                ? `${workload} claims · requires ${benchmarkAmountLabel(workload)} available`
                : operation === 'submit'
                  ? `${workload} claim submissions`
                  : `${workload} read calls`}
            </span>
          </div>

          {operation === 'submit' ? (
            <InlineNotice tone="warning" title="This creates on-chain demo claims">
              The workload submits {workload} synthetic claims with generated opaque references and
              zero-value evidence hashes. It does not include personal data. Claims remain pending
              afterwards; use the Claims page to reject or clean them up.
            </InlineNotice>
          ) : null}

          {settlementOperation ? (
            <InlineNotice tone="warning" title="Settlement setup is excluded from the measurement">
              {workload} synthetic claims are submitted and approved first ({workload * 2} setup
              transactions) using {benchmarkAmountLabel(workload)} of liquidity. Setup time is
              reported separately. Only the settlement transactions are measured. Self-approval must
              be enabled for this single-signer demo.
            </InlineNotice>
          ) : null}

          {operation === 'read' ? (
            <InlineNotice tone="info">
              Read-only workloads need no wallet. Latency reflects sequential RPC round trips
              through the configured provider, not validator execution time.
            </InlineNotice>
          ) : null}

          {settlementOperation && pool.data && !pool.data.allowSelfApproval ? (
            <div className="rounded-card border-warning-border bg-warning-bg text-ink-secondary border px-4 py-3 text-[13px] leading-5">
              Self-approval is disabled on this deployment. Use separate operator and approver
              accounts with the CLI benchmark, or enable the demo flag on a local deployment.
            </div>
          ) : null}

          {settlementOperation && pool.data && pool.data.available < requiredLiquidity ? (
            <div className="rounded-card border-warning-border bg-warning-bg text-ink-secondary border px-4 py-3 text-[13px] leading-5">
              Available liquidity is {formatToken(pool.data.available)} {TOKEN_SYMBOL}, below the{' '}
              {benchmarkAmountLabel(workload)} required for this workload. Add demo liquidity on the
              Liquidity page or reduce the workload.
            </div>
          ) : null}

          {pool.error ? (
            <ErrorState
              title="Pool safety settings unavailable"
              message="Settlement workloads need the pool's available liquidity and self-approval flag. Read and submit workloads remain available."
              onRetry={() => void pool.refetch()}
            />
          ) : null}

          {startDisabledReason && !isRunning ? (
            <p className="text-ink-muted flex items-start gap-2 text-xs leading-5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {startDisabledReason}
            </p>
          ) : null}

          {runError ? (
            <InlineNotice tone="danger" title="Workload could not start">
              {runError}
            </InlineNotice>
          ) : null}
        </CardContent>
      </Card>

      {progress ? (
        <Card>
          <CardHeader
            title="Run progress"
            description={progress.message}
            action={
              <div className="flex items-center gap-2">
                <Badge tone={PHASE_TONE[progress.phase]}>{progress.phase}</Badge>
                {!isRunning ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setProgress(null)}
                    aria-label="Clear run progress"
                  >
                    <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            }
          />
          <CardContent className="space-y-4 pt-4">
            <div>
              <div className="text-ink-secondary flex items-center justify-between gap-3 text-xs">
                <span>
                  {completedSamples} of {progress.samples.length} samples processed
                </span>
                <span className="tabular">{progressPercent}%</span>
              </div>
              <div className="bg-surface-muted mt-1.5 h-2 overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-300',
                    progress.phase === 'failed' ? 'bg-danger' : 'bg-primary',
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <span className="bg-surface-muted text-ink-secondary rounded-md px-2 py-1.5">
                Confirmed{' '}
                <span className="tabular text-ink-primary font-semibold">
                  {progress.samples.filter((sample) => sample.status === 'success').length}
                </span>
              </span>
              <span className="bg-surface-muted text-ink-secondary rounded-md px-2 py-1.5">
                Reverted{' '}
                <span className="tabular text-ink-primary font-semibold">
                  {progress.samples.filter((sample) => sample.status === 'reverted').length}
                </span>
              </span>
              <span className="bg-surface-muted text-ink-secondary rounded-md px-2 py-1.5">
                Failed{' '}
                <span className="tabular text-ink-primary font-semibold">
                  {progress.samples.filter((sample) => sample.status === 'error').length}
                </span>
              </span>
              <span className="bg-surface-muted text-ink-secondary rounded-md px-2 py-1.5">
                Pending{' '}
                <span className="tabular text-ink-primary font-semibold">
                  {progress.samples.filter((sample) => sample.status === 'skipped').length}
                </span>
              </span>
            </div>
            <SampleTable samples={progress.samples} />
          </CardContent>
        </Card>
      ) : null}

      {committedLoading && !report ? (
        <Card>
          <CardContent>
            <Skeleton className="h-4 w-40" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !report ? (
        <Card>
          <EmptyState
            title="No benchmark data yet"
            description="Run a synthetic workload to collect receipt latency, gas, and transaction success rate. Results are stored locally and can be exported."
            icon={<FlaskConical className="h-5 w-5" aria-hidden="true" />}
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setOperation('read');
                  setWorkload(10);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Use the 10-read preset
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Measured results"
              description="Every value below is derived from this run's samples and receipts."
              action={
                <div className="flex flex-wrap items-center gap-2">
                  {reportOptions.length > 0 ? (
                    <Select
                      value={report.id}
                      onChange={(event) => setSelectedId(event.target.value)}
                      aria-label="Select benchmark result"
                      className="h-9 w-[220px] text-xs"
                    >
                      {reportOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.source === 'cli' ? 'Reference' : 'Local'} ·{' '}
                          {new Date(item.startedAt).toLocaleDateString()} · {item.operation}
                        </option>
                      ))}
                    </Select>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={exportCsv}
                    title="Export samples as CSV"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={exportJson}
                    title="Export the full report as JSON"
                  >
                    <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
                    JSON
                  </Button>
                </div>
              }
            />
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={report.source === 'cli' ? 'info' : 'primary'}>
                  {report.source === 'cli' ? 'CLI reference run' : 'Browser run'}
                </Badge>
                <Badge tone="neutral">{OPERATION_LABELS[report.operation]}</Badge>
                <span className="text-ink-muted text-xs">
                  Workload {report.workloadSize}
                  {report.batchSize ? ` · batch ${report.batchSize}` : ''} · started{' '}
                  {formatDateTime(Math.floor(new Date(report.startedAt).getTime() / 1000))}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <BenchmarkMetric
                  label="Attempted"
                  value={formatInteger(report.summary.attempted)}
                  method="scheduled samples"
                />
                <BenchmarkMetric
                  label="Submitted"
                  value={formatInteger(report.summary.submitted)}
                  method="tx hash returned"
                />
                <BenchmarkMetric
                  label="Confirmed"
                  value={formatInteger(report.summary.confirmed)}
                  method="successful receipts"
                  tone="success"
                />
                <BenchmarkMetric
                  label="Reverted"
                  value={formatInteger(report.summary.reverted)}
                  method="receipt reverted"
                  tone={report.summary.reverted > 0 ? 'danger' : 'default'}
                />
                <BenchmarkMetric
                  label="Failed"
                  value={formatInteger(report.summary.failed)}
                  method="client / RPC errors"
                  tone={report.summary.failed > 0 ? 'danger' : 'default'}
                />
                <BenchmarkMetric
                  label="Success rate"
                  value={`${report.summary.successRate}%`}
                  method="confirmed ÷ attempted"
                  tone="success"
                />
                <BenchmarkMetric
                  label="Elapsed"
                  value={formatDuration(report.durationMs)}
                  method="measured phase only"
                />
                <BenchmarkMetric
                  label="Median latency"
                  value={formatLatency(report.summary.medianLatencyMs)}
                  method="submit → receipt"
                />
                <BenchmarkMetric
                  label="p95 latency"
                  value={
                    report.summary.p95LatencyMs === null
                      ? 'n/a'
                      : formatLatency(report.summary.p95LatencyMs)
                  }
                  method="needs ≥5 confirmed samples"
                />
                <BenchmarkMetric
                  label="Observed throughput"
                  value={formatRate(report.summary.throughputTps)}
                  method="confirmed ÷ measured time"
                  tone="primary"
                />
                <BenchmarkMetric
                  label="Total gas"
                  value={formatGas(report.summary.totalGas)}
                  method="sum of receipt gasUsed"
                />
                <BenchmarkMetric
                  label="Median gas"
                  value={formatGas(report.summary.medianGas)}
                  method="per successful tx"
                />
                <BenchmarkMetric
                  label="Claims processed"
                  value={formatInteger(report.summary.claimsProcessed)}
                  method="settlement workloads only"
                />
                <BenchmarkMetric
                  label="Setup time"
                  value={formatLatency(report.setupMs)}
                  method="excluded from samples"
                />
                <BenchmarkMetric
                  label="Samples"
                  value={formatInteger(report.samples.length)}
                  method="rows in exported report"
                />
              </div>

              {report.summary.reverted > 0 || report.summary.failed > 0 ? (
                <InlineNotice tone="danger" title="Some samples failed">
                  {report.summary.reverted} reverted and {report.summary.failed} failed. Failed
                  samples are included in the attempted count and export; they are not retried
                  automatically.
                </InlineNotice>
              ) : null}

              {report.setupNotes ? (
                <p className="text-ink-muted text-xs leading-5">{report.setupNotes}</p>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader
                title="Receipt latency by sample"
                description="Confirmed samples only. Hover or focus a bar for the measured value."
              />
              <CardContent className="pt-4">
                <LatencyChart report={report} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader
                title="Operation comparison"
                description="Latest median latency per operation across local and reference reports."
              />
              <CardContent className="pt-4">
                <ComparisonChart reports={allReports} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Sample log"
              description="Exact per-sample outcomes. The same rows are available in the CSV export."
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clear();
                    setSelectedId(null);
                  }}
                  disabled={reports.length === 0}
                  title="Remove browser-stored results. The committed reference report is kept."
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear local runs
                </Button>
              }
            />
            <CardContent className="pt-4">
              <SampleTable samples={report.samples} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Method and environment"
              description="Required context for interpreting the numbers."
            />
            <CardContent className="space-y-3 pt-4">
              <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-ink-muted text-[11px] font-medium uppercase tracking-[0.04em]">
                    Network
                  </dt>
                  <dd className="text-ink-primary mt-0.5">
                    {report.chainName} ({report.chainId})
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted text-[11px] font-medium uppercase tracking-[0.04em]">
                    RPC provider
                  </dt>
                  <dd className="text-ink-primary mt-0.5">{report.rpcProvider}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted text-[11px] font-medium uppercase tracking-[0.04em]">
                    Signer
                  </dt>
                  <dd className="mono text-ink-primary mt-0.5">{shortAddress(report.signer)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted text-[11px] font-medium uppercase tracking-[0.04em]">
                    Workload
                  </dt>
                  <dd className="text-ink-primary mt-0.5">
                    {report.workloadSize}
                    {report.batchSize ? ` · batch ${report.batchSize}` : ''}
                  </dd>
                </div>
              </dl>
              <div className="rounded-card border-info-border bg-info-bg text-ink-secondary border px-4 py-3 text-[12px] leading-5">
                <p className="flex items-start gap-2">
                  <RefreshCw className="text-info mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {METHODOLOGY_NOTE}
                </p>
              </div>
              <p className="text-ink-muted text-[11px] leading-4">
                Report ID <span className="mono">{report.id}</span> · finished{' '}
                {formatDateTime(Math.floor(new Date(report.finishedAt).getTime() / 1000))}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
