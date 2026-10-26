import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white shadow-sm hover:bg-primary-hover disabled:bg-primary/50 disabled:text-white/80',
  secondary:
    'bg-sidebar text-white hover:bg-sidebar-hover disabled:bg-sidebar/60 disabled:text-white/70',
  outline:
    'border border-border-strong bg-surface text-ink-secondary hover:border-primary/40 hover:bg-primary-soft hover:text-primary disabled:bg-surface-muted disabled:text-ink-muted',
  ghost: 'bg-transparent text-ink-secondary hover:bg-surface-muted hover:text-ink-primary',
  danger: 'bg-danger text-white hover:bg-[#982015] disabled:bg-danger/50 disabled:text-white/80',
  success: 'bg-success text-white hover:bg-[#05603a] disabled:bg-success/50 disabled:text-white/80',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 px-3 text-[13px]',
  md: 'h-11 gap-2 px-4 text-sm',
};

export function buttonStyles({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(
    'inline-flex select-none items-center justify-center rounded-field font-semibold transition-colors duration-150 disabled:cursor-not-allowed',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    isLoading,
    loadingLabel,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonStyles({ variant, size, className })}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {isLoading && loadingLabel ? loadingLabel : children}
    </button>
  );
});
