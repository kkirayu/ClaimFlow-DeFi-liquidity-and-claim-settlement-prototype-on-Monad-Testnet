import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from '@/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-hidden="true" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

export function MetricSkeleton() {
  return (
    <div className="card card-pad">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-36" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}
    >
      <div className="bg-surface-muted text-ink-muted mb-4 flex h-11 w-11 items-center justify-center rounded-full">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}
      </div>
      <h3 className="text-ink-primary text-sm font-semibold">{title}</h3>
      <p className="text-ink-secondary mt-1.5 max-w-md text-[13px] leading-5">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Could not load on-chain data',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-card border-danger-border bg-danger-bg flex flex-col items-start gap-3 border px-5 py-5 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-danger mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-danger text-sm font-semibold">{title}</p>
          <p className="text-ink-secondary mt-1 text-[13px] leading-5">{message}</p>
        </div>
      </div>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="shrink-0">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function InlineNotice({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'border-info-border bg-info-bg text-info',
    warning: 'border-warning-border bg-warning-bg text-warning',
    danger: 'border-danger-border bg-danger-bg text-danger',
    success: 'border-success-border bg-success-bg text-success',
  };
  return (
    <div
      className={cn('rounded-card border px-4 py-3 text-[13px] leading-5', tones[tone], className)}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={cn(title && 'mt-0.5', 'text-ink-secondary')}>{children}</div>
    </div>
  );
}

export function PageLoader({ label = 'Loading on-chain data…' }: { label?: string }) {
  return (
    <div className="rounded-card border-border bg-surface text-ink-secondary flex items-center gap-3 border px-5 py-6 text-sm">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
