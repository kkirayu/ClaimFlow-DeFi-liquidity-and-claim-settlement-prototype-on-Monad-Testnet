import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={cn(
        'text-ink-muted hover:bg-surface-muted hover:text-ink-primary focus-visible:ring-primary inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:ring-2',
        className,
      )}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      onClick={async () => {
        const success = await copyText(value);
        if (success) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }
      }}
    >
      {copied ? (
        <Check className="text-success h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

export function Copyable({
  children,
  value,
  className,
}: {
  children: ReactNode;
  value: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {children}
      <CopyButton value={value} />
    </span>
  );
}
