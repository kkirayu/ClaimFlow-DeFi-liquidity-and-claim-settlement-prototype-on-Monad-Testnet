import { Link } from 'react-router-dom';
import { ArrowRight, Banknote, Gauge, LockKeyhole, Plus, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { MetricCard } from '@/components/data-display/MetricCard';
import { MetricSkeleton, ErrorState } from '@/components/ui/Feedback';
import { buttonStyles } from '@/components/ui/Button';
import { formatToken, formatUtilization } from '@/lib/format';
import { useClaimStats, usePoolSnapshot, useProtocolEvents } from '@/hooks/useProtocol';
import { useBenchmarkReports } from '@/hooks/useBenchmarkReports';
import { readErrorMessage } from '@/lib/errors';
import { ClaimsSummary } from '@/features/dashboard/ClaimsSummary';
import { RecentActivityCard } from '@/features/dashboard/RecentActivityCard';
import { PerformanceSnapshot } from '@/features/dashboard/PerformanceSnapshot';

export function OverviewPage() {
  const pool = usePoolSnapshot();
  const stats = useClaimStats();
  const events = useProtocolEvents();
  const { latest, committedLoading } = useBenchmarkReports();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        description="Liquidity and claim settlement on Monad Testnet. Available and reserved funds are accounted separately."
        actions={
          <>
            <Link to="/benchmark" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
              Run benchmark
            </Link>
            <Link to="/liquidity" className={buttonStyles({ size: 'sm' })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add liquidity
            </Link>
          </>
        }
      />

      {pool.error ? (
        <ErrorState
          title="Pool metrics unavailable"
          message={readErrorMessage(pool.error).message}
          onRetry={() => void pool.refetch()}
        />
      ) : (
        <section aria-label="Pool metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {pool.isPending || !pool.data ? (
            <>
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
            </>
          ) : (
            <>
              <MetricCard
                label="Vault balance"
                value={`${formatToken(pool.data.totalAssets)} mUSDC`}
                hint="Actual token balance held by the vault"
                icon={<Banknote className="h-4 w-4" aria-hidden="true" />}
                to="/liquidity"
                title="Vault balance"
              />
              <MetricCard
                label="Available liquidity"
                value={`${formatToken(pool.data.available)} mUSDC`}
                hint="Not reserved; usable for claims and withdrawals"
                icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
                tone="available"
                to="/liquidity"
                title="Available liquidity"
              />
              <MetricCard
                label="Reserved liquidity"
                value={`${formatToken(pool.data.reserved)} mUSDC`}
                hint="Locked for approved claims"
                icon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}
                tone="reserved"
                to="/settlement"
                title="Reserved liquidity"
              />
              <MetricCard
                label="Pool utilization"
                value={formatUtilization(pool.data.reserved, pool.data.totalAssets)}
                hint="Reserved ÷ vault balance"
                icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
                to="/liquidity"
                title="Pool utilization"
              />
            </>
          )}
        </section>
      )}

      <ClaimsSummary
        stats={stats.data}
        isLoading={stats.isPending}
        error={stats.error}
        onRetry={() => void stats.refetch()}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RecentActivityCard
          events={events.data ?? []}
          isLoading={events.isPending}
          error={events.error}
          onRetry={() => void events.refetch()}
        />
        <div className="space-y-5">
          <PerformanceSnapshot report={latest} isLoading={committedLoading && !latest} />

          {!pool.isPending && !pool.error && pool.data ? (
            <div className="card p-5">
              <p className="text-ink-primary text-sm font-semibold">Accounting reminder</p>
              <dl className="mt-3 space-y-2 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-secondary">Vault balance</dt>
                  <dd className="tabular text-ink-primary font-medium">
                    {formatToken(pool.data.totalAssets)} mUSDC
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-secondary">Reserved</dt>
                  <dd className="tabular text-primary font-medium">
                    {formatToken(pool.data.reserved)} mUSDC
                  </dd>
                </div>
                <div className="border-border flex items-center justify-between gap-3 border-t pt-2">
                  <dt className="text-ink-primary font-medium">Available</dt>
                  <dd className="tabular text-success font-semibold">
                    {formatToken(pool.data.available)} mUSDC
                  </dd>
                </div>
              </dl>
              <Link
                to="/liquidity"
                className="text-primary mt-3 inline-flex items-center gap-1 text-xs font-semibold hover:underline"
              >
                Review liquidity
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
