import { Link } from 'react-router-dom';
import { ArrowRight, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function MetricCard({
  label,
  value,
  hint,
  icon,
  to,
  tone = 'default',
  loading = false,
  title,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  to?: string;
  tone?: 'default' | 'available' | 'reserved' | 'danger';
  loading?: boolean;
  title?: string;
}) {
  const toneClass = {
    default: 'text-ink-primary',
    available: 'text-success',
    reserved: 'text-primary',
    danger: 'text-danger',
  }[tone];

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-ink-secondary text-[13px] font-medium">{label}</span>
        {icon ? (
          <span className="bg-surface-muted text-ink-muted flex h-8 w-8 items-center justify-center rounded-lg">
            {icon}
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-32 animate-pulse rounded-md bg-[#E9EDF5]" />
      ) : (
        <p
          className={cn(
            'tabular mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em]',
            toneClass,
          )}
        >
          {value}
        </p>
      )}
      <div className="mt-2 flex min-h-[20px] items-center justify-between gap-2">
        {hint ? <span className="text-ink-muted text-xs leading-5">{hint}</span> : <span />}
        {to ? (
          <ArrowRight className="text-ink-muted h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : null}
      </div>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="card card-pad hover:border-primary/30 group transition-colors"
        title={title}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="card card-pad" title={title}>
      {content}
    </div>
  );
}

export function DefinitionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <Info className="text-ink-muted h-3 w-3" aria-hidden="true" />
    </span>
  );
}
