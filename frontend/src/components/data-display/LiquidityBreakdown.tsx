import { formatToken, formatUtilization } from '@/lib/format';
import { cn } from '@/lib/cn';

function bpsOf(part: bigint, whole: bigint): number {
  if (whole === 0n) return 0;
  return Number((part * 10_000n) / whole);
}

export function LiquidityBreakdown({
  balance,
  available,
  reserved,
  className,
}: {
  balance: bigint;
  available: bigint;
  reserved: bigint;
  className?: string;
}) {
  const availableBps = Math.min(10_000, bpsOf(available, balance));
  const reservedBps = balance === 0n ? 0 : Math.max(0, 10_000 - availableBps);

  return (
    <div className={cn('rounded-card border-border bg-surface border p-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-ink-primary text-sm font-semibold">Vault composition</p>
        <p className="text-ink-muted text-xs">
          Utilization{' '}
          <span className="tabular text-ink-secondary font-medium">
            {formatUtilization(reserved, balance)}
          </span>
        </p>
      </div>

      <div
        className="bg-surface-muted mt-4 flex h-3 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`Vault balance ${formatToken(balance)} mUSDC: available ${formatToken(available)}, reserved ${formatToken(reserved)}.`}
      >
        {availableBps > 0 ? (
          <div className="bg-success h-full" style={{ width: `${availableBps / 100}%` }} />
        ) : null}
        {reservedBps > 0 ? (
          <div className="bg-primary h-full" style={{ width: `${reservedBps / 100}%` }} />
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <span className="bg-success h-2.5 w-2.5 rounded-sm" aria-hidden="true" />
          <span className="text-ink-secondary">Available</span>
          <span className="tabular text-success ml-auto font-semibold sm:ml-1">
            {formatToken(available)} mUSDC
          </span>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <span className="bg-primary h-2.5 w-2.5 rounded-sm" aria-hidden="true" />
          <span className="text-ink-secondary">Reserved</span>
          <span className="tabular text-primary ml-auto font-semibold sm:ml-1">
            {formatToken(reserved)} mUSDC
          </span>
        </div>
      </div>
      <p className="text-ink-muted mt-3 text-[11px] leading-4">
        Reserved tokens are locked for approved claims and cannot be withdrawn by LPs until the
        claim is paid or its reservation is released.
      </p>
    </div>
  );
}
