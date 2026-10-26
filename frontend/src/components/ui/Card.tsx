import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
  titleAs: Title = 'h2',
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  titleAs?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:pt-6',
        className,
      )}
    >
      <div className="min-w-0">
        <Title className="text-ink-primary text-lg font-semibold tracking-[-0.01em]">{title}</Title>
        {description ? (
          <p className="text-ink-secondary mt-1 max-w-2xl text-[13px] leading-5">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-5 sm:px-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-border flex flex-wrap items-center gap-3 border-t px-5 py-4 sm:px-6',
        className,
      )}
      {...props}
    />
  );
}
