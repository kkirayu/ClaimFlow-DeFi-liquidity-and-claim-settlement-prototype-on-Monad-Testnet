import { Link } from 'react-router-dom';
import { Activity, ArrowRight } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { formatDateTime, formatGas, formatLatency, formatRate } from '@/lib/format';
import { OPERATION_LABELS, type BenchmarkReport } from '@/lib/benchmark/types';

export function PerformanceSnapshot({
  report,
  isLoading,
}: {
  report: BenchmarkReport | null;
  isLoading: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Performance snapshot"
        description="Last measured synthetic workload. Metrics describe this workload only."
        action={
          <Link to="/benchmark" className="text-primary text-xs font-semibold hover:underline">
            Open lab
          </Link>
        }
      />
      {isLoading ? (
        <div className="border-border mt-5 space-y-4 border-t p-5">
          <Skeleton className="h-4 w-40" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      ) : !report ? (
        <EmptyState
          title="No benchmark data yet"
          description="Run a synthetic workload to measure receipt latency, gas, and transaction success rate."
          icon={<Activity className="h-5 w-5" aria-hidden="true" />}
          action={
            <Link to="/benchmark" className={buttonStyles({ size: 'sm' })}>
              Run benchmark
            </Link>
          }
        />
      ) : (
        <div className="border-border border-t px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={report.source === 'cli' ? 'info' : 'primary'}>
              {report.source === 'cli' ? 'CLI run' : 'Browser run'}
            </Badge>
            <Badge tone="neutral">{OPERATION_LABELS[report.operation]}</Badge>
            <span className="text-ink-muted text-xs">
              {formatDateTime(Math.floor(new Date(report.startedAt).getTime() / 1000))}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-ink-muted text-[11px] font-medium">Success</p>
              <p className="tabular text-success mt-0.5 text-lg font-semibold">
                {report.summary.successRate}%
              </p>
            </div>
            <div>
              <p className="text-ink-muted text-[11px] font-medium">Median latency</p>
              <p className="tabular text-ink-primary mt-0.5 text-lg font-semibold">
                {formatLatency(report.summary.medianLatencyMs)}
              </p>
            </div>
            <div>
              <p className="text-ink-muted text-[11px] font-medium">Throughput</p>
              <p className="tabular text-ink-primary mt-0.5 text-lg font-semibold">
                {formatRate(report.summary.throughputTps)}
              </p>
            </div>
            <div>
              <p className="text-ink-muted text-[11px] font-medium">Claims processed</p>
              <p className="tabular text-ink-primary mt-0.5 text-lg font-semibold">
                {report.summary.claimsProcessed}
              </p>
            </div>
          </div>

          <p className="text-ink-muted mt-3 text-[11px] leading-4">
            Workload {report.workloadSize}
            {report.batchSize ? ` · batch size ${report.batchSize}` : ''} ·{' '}
            {report.summary.confirmed}/{report.summary.attempted} confirmed ·{' '}
            {formatGas(report.summary.totalGas)} gas units total
          </p>

          <Link
            to="/benchmark"
            className="text-primary mt-3 inline-flex items-center gap-1 text-xs font-semibold hover:underline"
          >
            View full results
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </Card>
  );
}
