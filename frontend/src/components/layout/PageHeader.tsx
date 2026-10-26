import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="min-w-0">
        <h1 className="text-ink-primary text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[30px]">
          {title}
        </h1>
        {description ? (
          <p className="text-ink-secondary mt-1.5 max-w-2xl text-sm leading-6">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
