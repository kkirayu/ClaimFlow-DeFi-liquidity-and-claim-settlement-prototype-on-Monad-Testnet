import { CheckCircle2, Clock3, LockKeyhole, Ban, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { ClaimStatus, STATUS_META } from '@/lib/claims';
import { cn } from '@/lib/cn';

const ICONS: Record<ClaimStatus, ReactNode> = {
  [ClaimStatus.None]: <XCircle className="h-3.5 w-3.5" aria-hidden="true" />,
  [ClaimStatus.Pending]: <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />,
  [ClaimStatus.ApprovedReserved]: <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />,
  [ClaimStatus.Paid]: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
  [ClaimStatus.Rejected]: <XCircle className="h-3.5 w-3.5" aria-hidden="true" />,
  [ClaimStatus.Cancelled]: <Ban className="h-3.5 w-3.5" aria-hidden="true" />,
};

const classes: Record<ClaimStatus, string> = {
  [ClaimStatus.None]: 'border-border bg-surface-muted text-ink-secondary',
  [ClaimStatus.Pending]: 'border-warning-border bg-warning-bg text-warning',
  [ClaimStatus.ApprovedReserved]: 'border-[#C7D7FE] bg-primary-soft text-primary',
  [ClaimStatus.Paid]: 'border-success-border bg-success-bg text-success',
  [ClaimStatus.Rejected]: 'border-danger-border bg-danger-bg text-danger',
  [ClaimStatus.Cancelled]: 'border-border-strong bg-surface-muted text-ink-secondary',
};

export function StatusBadge({
  status,
  compact = false,
  className,
}: {
  status: ClaimStatus;
  compact?: boolean;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'rounded-badge inline-flex w-fit items-center gap-1.5 border px-2.5 py-1 text-xs font-medium leading-none',
        classes[status],
        className,
      )}
      title={meta.description}
    >
      {ICONS[status]}
      {compact ? meta.shortLabel : meta.label}
    </span>
  );
}
