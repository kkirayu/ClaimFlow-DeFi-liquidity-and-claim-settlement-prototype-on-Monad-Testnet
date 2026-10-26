import type { ReactNode } from 'react';
import { Field, Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

export function AmountInput({
  id,
  label,
  value,
  onChange,
  onMax,
  maxLabel,
  hint,
  error,
  disabled,
  suffix = 'mUSDC',
  placeholder = '0.00',
  required,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onMax?: () => void;
  maxLabel?: string;
  hint?: ReactNode;
  error?: string;
  disabled?: boolean;
  suffix?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} required={required}>
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          invalid={Boolean(error)}
          disabled={disabled}
          className={cn('tabular pr-32 text-[15px]', error && 'pr-32')}
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {onMax && maxLabel ? (
            <button
              type="button"
              onClick={onMax}
              disabled={disabled}
              className="text-primary hover:bg-primary-soft disabled:text-ink-muted rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors disabled:cursor-not-allowed"
            >
              {maxLabel}
            </button>
          ) : null}
          <span className="text-ink-muted pr-1 text-xs font-medium">{suffix}</span>
        </div>
      </div>
    </Field>
  );
}
