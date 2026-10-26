import { AlertTriangle, CheckCircle2, Loader2, Wallet } from 'lucide-react';
import { TxLink } from '@/components/data-display/AddressText';
import { cn } from '@/lib/cn';
import { formatLatency, formatGas } from '@/lib/format';
import { useTransaction } from './TransactionProvider';

/** Inline transaction state for panels and dialogs. Confirmation is receipt-based. */
export function TransactionState({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { state } = useTransaction();
  if (state.phase === 'idle') return null;

  const failed = state.phase === 'failed';
  const confirmed = state.phase === 'confirmed';
  const pending = state.phase === 'pending' || state.phase === 'awaiting-signature';
  const latency =
    state.startedAt && state.confirmedAt ? state.confirmedAt - state.startedAt : undefined;

  return (
    <div
      className={cn(
        'rounded-card border px-4 py-3 text-[13px]',
        failed && 'border-danger-border bg-danger-bg',
        confirmed && 'border-success-border bg-success-bg',
        pending && 'border-info-border bg-info-bg',
        className,
      )}
      role={failed ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-2.5">
        {failed ? (
          <AlertTriangle className="text-danger mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : confirmed ? (
          <CheckCircle2 className="text-success mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : state.phase === 'awaiting-signature' ? (
          <Wallet className="text-info mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <Loader2 className="text-info mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'font-semibold',
              failed ? 'text-danger' : confirmed ? 'text-success' : 'text-info',
            )}
          >
            {state.phase === 'awaiting-signature'
              ? 'Waiting for wallet signature'
              : state.phase === 'pending'
                ? 'Transaction pending'
                : state.phase === 'confirmed'
                  ? 'Transaction confirmed'
                  : (state.error?.title ?? 'Transaction failed')}
          </p>
          <p className="text-ink-secondary mt-0.5">
            {state.phase === 'awaiting-signature'
              ? `${state.label} — nothing is sent until you sign.`
              : state.phase === 'pending'
                ? `${state.label} — submitted, waiting for the on-chain receipt.`
                : state.phase === 'confirmed'
                  ? state.label
                  : state.error?.message}
          </p>
          {!compact && state.hash ? (
            <div className="text-ink-muted mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <TxLink hash={state.hash} />
              {confirmed ? (
                <>
                  <span>Gas {formatGas(state.receipt?.gasUsed)}</span>
                  <span>{formatLatency(latency)} end-to-end</span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
