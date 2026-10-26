import { AlertTriangle, Layers, ShieldAlert } from 'lucide-react';
import type { ClaimRecord } from '@/lib/claims';
import { BATCH_ALL_OR_NOTHING_COPY } from '@/lib/contracts';
import { formatGas, formatToken, shortHash } from '@/lib/format';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/Feedback';
import { TransactionState } from './TransactionState';
import { AddressText } from '@/components/data-display/AddressText';

export function BatchPreview({
  open,
  onClose,
  claims,
  cap,
  gasEstimate,
  gasLoading,
  gasUnavailable,
  onConfirm,
  isBusy,
  total,
}: {
  open: boolean;
  onClose: () => void;
  claims: ClaimRecord[];
  cap: bigint;
  gasEstimate?: bigint;
  gasLoading?: boolean;
  gasUnavailable?: boolean;
  onConfirm: () => void | Promise<void>;
  isBusy: boolean;
  total: bigint;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${claims.length} ${claims.length === 1 ? 'claim' : 'claims'} selected`}
      description="Review every recipient and amount before signing. The contract pays the batch in one transaction."
      size="lg"
      preventClose={isBusy}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            Back
          </Button>
          <Button
            type="button"
            variant="success"
            onClick={() => void onConfirm()}
            isLoading={isBusy}
            loadingLabel="Waiting for wallet…"
            disabled={claims.length === 0}
          >
            Confirm batch settlement
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-card border-border bg-surface-muted/50 border px-4 py-3">
            <p className="text-ink-muted text-xs font-medium">Total payout</p>
            <p className="tabular text-ink-primary mt-1 text-xl font-semibold">
              {formatToken(total)} <span className="text-ink-muted text-sm font-medium">mUSDC</span>
            </p>
          </div>
          <div className="rounded-card border-border bg-surface-muted/50 border px-4 py-3">
            <p className="text-ink-muted text-xs font-medium">Gas estimate</p>
            <p className="tabular text-ink-primary mt-1 text-xl font-semibold">
              {gasLoading ? (
                <span className="text-ink-muted text-sm font-medium">Estimating…</span>
              ) : gasEstimate !== undefined ? (
                formatGas(gasEstimate)
              ) : gasUnavailable ? (
                <span className="text-ink-muted text-sm font-medium">Estimate unavailable</span>
              ) : (
                <span className="text-ink-muted text-sm font-medium">Not estimated</span>
              )}
            </p>
          </div>
        </div>

        <div className="scrollbar-subtle rounded-card border-border max-h-64 overflow-auto border">
          <table className="w-full min-w-[520px] border-collapse">
            <thead className="table-head">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Claim</th>
                <th className="px-3 py-2 text-left font-semibold">Recipient</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.claimId} className="border-border border-t">
                  <td className="px-3 py-2.5">
                    <span className="mono text-[11px]" title={claim.claimId}>
                      {shortHash(claim.claimId, 8)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <AddressText address={claim.recipient} explorer={false} className="text-xs" />
                  </td>
                  <td className="tabular text-ink-primary px-3 py-2.5 text-right text-[13px] font-medium">
                    {formatToken(claim.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-card border-border bg-surface-muted/50 text-ink-secondary flex flex-wrap items-center justify-between gap-2 border px-4 py-3 text-xs">
          <span className="inline-flex items-center gap-2">
            <Layers className="text-ink-muted h-4 w-4" aria-hidden="true" />
            Batch cap: <span className="tabular font-semibold">{cap.toString()}</span> claims
          </span>
          <span className="text-ink-muted">
            Selected {claims.length} of {cap.toString()} allowed
          </span>
        </div>
        <p className="text-ink-muted text-xs leading-5">
          The cap bounds the gas used by one transaction and limits how many claims can be reviewed
          at once. The contract rejects larger batches.
        </p>

        <InlineNotice tone="warning" title="All-or-nothing transaction">
          <span className="inline-flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {BATCH_ALL_OR_NOTHING_COPY} If one claim is no longer approved and reserved, no claim in
            this batch is paid.
          </span>
        </InlineNotice>

        <TransactionState compact />

        <p className="text-ink-muted flex items-start gap-2 text-[11px] leading-4">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          Verify recipients before signing. A confirmed payout is irreversible.
        </p>
      </div>
    </Dialog>
  );
}
