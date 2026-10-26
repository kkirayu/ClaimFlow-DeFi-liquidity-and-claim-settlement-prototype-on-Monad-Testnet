import type { ReactNode } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/Feedback';
import { TransactionState } from './TransactionState';

export function ConfirmActionDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  isBusy = false,
  children,
  warning,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger' | 'success';
  isBusy?: boolean;
  children: ReactNode;
  warning?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      preventClose={isBusy}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : 'primary'}
            onClick={() => void onConfirm()}
            isLoading={isBusy}
            loadingLabel="Waiting for wallet…"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {children}
        {warning ? (
          <InlineNotice tone="warning" title="Before you sign">
            {warning}
          </InlineNotice>
        ) : (
          <InlineNotice tone="info" title="On-chain action">
            <span className="inline-flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              The smart contract enforces permissions and state. This interface cannot bypass them.
            </span>
          </InlineNotice>
        )}
        <TransactionState />
        <p className="text-ink-muted flex items-start gap-2 text-[11px] leading-4">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          Testnet only. Amounts are mock tokens with no monetary value.
        </p>
      </div>
    </Dialog>
  );
}
