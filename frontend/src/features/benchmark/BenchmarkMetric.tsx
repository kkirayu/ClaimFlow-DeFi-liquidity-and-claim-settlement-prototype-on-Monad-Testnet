import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function BenchmarkMetric({
  label,
  value,
  method,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  method: string;
  tone?: 'default' | 'success' | 'danger' | 'primary';
}) {
  const toneClass = {
    default: 'text-ink-primary',
    success: 'text-success',
    danger: 'text-danger',
    primary: 'text-primary',
  }[tone];

  return (
    <div className="card px-4 py-3.5">
      <p className="text-ink-muted text-[11px] font-medium uppercase tracking-[0.04em]">{label}</p>
      <p className={cn('tabular mt-1 text-xl font-semibold leading-tight', toneClass)}>{value}</p>
      <p className="text-ink-muted mt-1 text-[10px] leading-4">{method}</p>
    </div>
  );
}
