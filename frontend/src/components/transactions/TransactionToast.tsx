import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Wallet, X } from 'lucide-react';
import { TxLink } from '@/components/data-display/AddressText';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useTransaction } from './TransactionProvider';

const PHASE_COPY = {
  'awaiting-signature': 'Confirm in wallet',
  pending: 'Transaction pending',
  confirmed: 'Transaction confirmed',
  failed: 'Transaction failed',
} as const;

export function TransactionToast() {
  const { state, reset } = useTransaction();
  const visible = state.phase !== 'idle';

  useEffect(() => {
    if (state.phase !== 'confirmed') return;
    const timer = window.setTimeout(reset, 10_000);
    return () => window.clearTimeout(timer);
  }, [reset, state.phase, state.id]);

  if (!visible) return null;

  const failed = state.phase === 'failed';
  const confirmed = state.phase === 'confirmed';
  const pending = state.phase === 'pending' || state.phase === 'awaiting-signature';

  return (
    <div
      className="animate-slide-in fixed bottom-4 right-4 z-[70] w-[min(420px,calc(100vw-2rem))]"
      role={failed ? 'alert' : 'status'}
      aria-live={failed ? 'assertive' : 'polite'}
    >
      <div
        className={cn(
          'card shadow-pop overflow-hidden',
          failed && 'border-danger-border',
          confirmed && 'border-success-border',
        )}
      >
        <div className="flex items-start gap-3 p-4">
          <span
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
              failed && 'bg-danger-bg text-danger',
              confirmed && 'bg-success-bg text-success',
              pending && 'bg-primary-soft text-primary',
            )}
          >
            {failed ? (
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            ) : confirmed ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            ) : state.phase === 'awaiting-signature' ? (
              <Wallet className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'text-sm font-semibold',
                failed ? 'text-danger' : confirmed ? 'text-success' : 'text-ink-primary',
              )}
            >
              {PHASE_COPY[state.phase as keyof typeof PHASE_COPY]}
            </p>
            <p className="text-ink-secondary mt-0.5 text-[13px] leading-5">{state.label}</p>

            {state.phase === 'awaiting-signature' ? (
              <p className="text-ink-muted mt-1 text-xs leading-5">
                The request is waiting for your wallet. Nothing is sent until you sign.
              </p>
            ) : null}

            {state.phase === 'pending' ? (
              <p className="text-ink-muted mt-1 text-xs leading-5">
                Submitted to the network. Success is assumed only after the receipt confirms.
              </p>
            ) : null}

            {state.error ? (
              <div className="mt-2">
                <p className="text-ink-primary text-[13px] font-medium">{state.error.title}</p>
                <p className="text-ink-secondary mt-0.5 text-xs leading-5">{state.error.message}</p>
                {state.error.details ? (
                  <details className="mt-1.5">
                    <summary className="text-ink-muted hover:text-primary cursor-pointer text-xs">
                      Technical details
                    </summary>
                    <p className="mono bg-surface-muted text-ink-secondary mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap break-all rounded-md p-2 text-[11px] leading-4">
                      {state.error.details}
                    </p>
                  </details>
                ) : null}
              </div>
            ) : null}

            {state.hash ? (
              <div className="mt-2 text-xs">
                <TxLink hash={state.hash} label="View transaction" />
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mr-1 -mt-1 h-7 w-7 shrink-0 px-0"
            onClick={reset}
            aria-label="Dismiss transaction status"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
        {confirmed ? (
          <div className="border-border bg-success-bg/50 text-ink-secondary border-t px-4 py-2 text-xs">
            On-chain state has been refreshed from the contract and event logs.
          </div>
        ) : null}
      </div>
    </div>
  );
}
