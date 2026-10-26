import { ArrowUpRight } from 'lucide-react';
import { explorerAddressUrl, explorerTxUrl } from '@/lib/chain';
import { shortAddress, shortHash } from '@/lib/format';
import { cn } from '@/lib/cn';
import { CopyButton } from '@/components/ui/CopyButton';

export function AddressText({
  address,
  full = false,
  copy = true,
  explorer = true,
  className,
}: {
  address?: string;
  full?: boolean;
  copy?: boolean;
  explorer?: boolean;
  className?: string;
}) {
  if (!address) return <span className="text-ink-muted">—</span>;
  const href = explorer ? explorerAddressUrl(address) : undefined;

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      <span className="mono truncate" title={address}>
        {full ? address : shortAddress(address)}
      </span>
      {copy ? <CopyButton value={address} label="Copy address" /> : null}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-muted hover:bg-surface-muted hover:text-primary inline-flex h-7 w-6 items-center justify-center rounded-md transition-colors"
          aria-label="Open address in block explorer"
          title="Open in explorer"
        >
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      ) : null}
    </span>
  );
}

export function HashText({
  hash,
  full = false,
  copy = true,
  className,
}: {
  hash?: string;
  full?: boolean;
  copy?: boolean;
  className?: string;
}) {
  if (!hash) return <span className="text-ink-muted">—</span>;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      <span className="mono truncate" title={hash}>
        {full ? hash : shortHash(hash)}
      </span>
      {copy ? <CopyButton value={hash} label="Copy hash" /> : null}
    </span>
  );
}

export function TxLink({
  hash,
  label,
  className,
}: {
  hash?: string;
  label?: string;
  className?: string;
}) {
  if (!hash) return <span className="text-ink-muted">—</span>;
  const href = explorerTxUrl(hash);
  const content = (
    <>
      <span className="mono">{label ?? shortHash(hash)}</span>
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
    </>
  );
  if (!href) {
    return (
      <span className={cn('text-ink-muted inline-flex items-center gap-1', className)} title={hash}>
        {content}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'text-primary hover:text-primary-hover inline-flex items-center gap-1 hover:underline',
        className,
      )}
      title={hash}
    >
      {content}
    </a>
  );
}
