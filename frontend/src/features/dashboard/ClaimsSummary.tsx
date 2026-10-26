import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, LockKeyhole, XCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { formatInteger } from '@/lib/format';
import type { StatsSnapshot } from '@/hooks/useProtocol';
import { cn } from '@/lib/cn';

const ITEMS = [
  {
    key: 'pending',
    label: 'Pending approval',
    status: '1',
    icon: Clock3,
    className: 'text-warning',
    background: 'bg-warning-bg',
  },
  {
    key: 'approvedReserved',
    label: 'Approved & reserved',
    status: '2',
    icon: LockKeyhole,
    className: 'text-primary',
    background: 'bg-primary-soft',
  },
  {
    key: 'paid',
    label: 'Paid',
    status: '3',
    icon: CheckCircle2,
    className: 'text-success',
    background: 'bg-success-bg',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    status: '4',
    icon: XCircle,
    className: 'text-danger',
    background: 'bg-danger-bg',
  },
] as const;

export function ClaimsSummary({
  stats,
  isLoading,
  error,
  onRetry,
}: {
  stats?: StatsSnapshot;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Claim queue"
        description="On-chain counters grouped by lifecycle state."
        action={
          <Link
            to="/claims"
            className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline"
          >
            View claims
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        }
      />
      {error ? (
        <div className="px-5 pb-5 sm:px-6">
          <ErrorState
            title="Claim counters unavailable"
            message="The claim counters could not be read. They are not displayed as zero."
            onRetry={onRetry}
          />
        </div>
      ) : (
        <div className="border-border bg-border mt-5 grid grid-cols-2 gap-px border-t sm:grid-cols-4">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={`/claims?status=${item.status}`}
                className="bg-surface hover:bg-surface-muted/60 group px-5 py-4 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg',
                      item.background,
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', item.className)} aria-hidden="true" />
                  </span>
                  <ArrowRight
                    className="text-ink-muted h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-ink-secondary mt-2.5 text-[12px] font-medium">{item.label}</p>
                {isLoading || !stats ? (
                  <Skeleton className="mt-1.5 h-7 w-10" />
                ) : (
                  <p className="tabular text-ink-primary mt-1 text-2xl font-semibold">
                    {formatInteger(stats[item.key])}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
