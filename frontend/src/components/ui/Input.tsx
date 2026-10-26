import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, suffix, ...props },
  ref,
) {
  if (!suffix) {
    return (
      <input
        ref={ref}
        className={cn('field', invalid && 'field-error', className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  }

  return (
    <div className="relative">
      <input
        ref={ref}
        className={cn('field pr-20', invalid && 'field-error', className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
      <span className="text-ink-muted pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium">
        {suffix}
      </span>
    </div>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn('field appearance-none pr-9', invalid && 'field-error', className)}
      aria-invalid={invalid || undefined}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23667085' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
      }}
      {...props}
    >
      {children}
    </select>
  );
});

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="text-danger ml-1" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="text-danger mt-1.5 text-xs font-medium" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="help-text">{hint}</p>
      ) : null}
    </div>
  );
}

export function useFieldId(prefix: string): string {
  const id = useId();
  return `${prefix}-${id}`;
}
