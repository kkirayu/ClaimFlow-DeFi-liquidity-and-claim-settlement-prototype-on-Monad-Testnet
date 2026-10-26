import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-border bg-surface-muted text-ink-secondary',
  info: 'border-[#C7D7FE] bg-primary-soft text-primary',
  success: 'border-success-border bg-success-bg text-success',
  warning: 'border-warning-border bg-warning-bg text-warning',
  danger: 'border-danger-border bg-danger-bg text-danger',
  primary: 'border-primary/20 bg-primary-soft text-primary',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  icon,
  title,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'rounded-badge inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium leading-none',
        toneClasses[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
