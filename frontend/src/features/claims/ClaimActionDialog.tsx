import { AlertTriangle } from 'lucide-react';
import { ConfirmActionDialog } from '@/components/transactions/ConfirmActionDialog';
import { AddressText, HashText } from '@/components/data-display/AddressText';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { useTransaction } from '@/components/transactions/TransactionProvider';
import { requireProtocol } from '@/lib/contracts';
import { formatToken, shortAddress, shortHash } from '@/lib/format';
import type { ClaimAction, ClaimRecord } from '@/lib/claims';

const COPY: Record<
  ClaimAction,
  {
    title: string;
    confirm: string;
    tone: 'primary' | 'danger' | 'success';
    body: (claim: ClaimRecord) => string;
    warning?: (claim: ClaimRecord) => string;
  }
> = {
  approve: {
    title: 'Approve and reserve liquidity',
    confirm: 'Approve & reserve',
    tone: 'primary',
    body: (claim) =>
      `Approving this claim reserves ${formatToken(claim.amount)} mUSDC from available liquidity. The amount will not be available for LP withdrawal while reserved.`,
  },
  reject: {
    title: 'Reject this claim',
    confirm: 'Reject claim',
    tone: 'danger',
    body: () =>
      'Rejecting is a terminal decision. No liquidity is reserved, and the claim cannot be approved later.',
    warning: () => 'Rejection is irreversible once confirmed on-chain.',
  },
  cancel: {
    title: 'Cancel this pending claim',
    confirm: 'Cancel claim',
    tone: 'danger',
    body: () =>
      'Cancelling this pending claim is terminal. No liquidity was reserved, so no reservation needs to be released.',
    warning: () => 'Cancellation is irreversible once confirmed on-chain.',
  },
  'cancel-release': {
    title: 'Cancel and release reservation',
    confirm: 'Cancel & release reservation',
    tone: 'danger',
    body: (claim) =>
      `Cancelling this approved claim releases ${formatToken(claim.amount)} mUSDC back to available liquidity. No tokens are transferred to the recipient.`,
    warning: () =>
      'This releases the reservation and makes the funds withdrawable by LPs again. Cancellation is terminal.',
  },
  settle: {
    title: 'Settle this claim',
    confirm: 'Settle payout',
    tone: 'success',
    body: (claim) =>
      `You are about to transfer ${formatToken(claim.amount)} mUSDC to ${shortAddress(claim.recipient)}. This action is irreversible once confirmed on-chain. Check the claim and recipient before signing.`,
    warning: () =>
      'The payout is final. Verify the recipient and amount. The contract clears the reservation before transferring tokens, which prevents double payout.',
  },
};

export function ClaimActionDialog({
  claim,
  action,
  open,
  onClose,
  onConfirmed,
}: {
  claim: ClaimRecord;
  action: ClaimAction;
  open: boolean;
  onClose: () => void;
  onConfirmed?: () => void;
}) {
  const { run, isBusy } = useTransaction();
  const copy = COPY[action];
  const { manager } = requireProtocol();

  const handleConfirm = async () => {
    const functionName =
      action === 'approve'
        ? 'approveClaim'
        : action === 'reject'
          ? 'rejectClaim'
          : action === 'settle'
            ? 'settleClaim'
            : 'cancelClaim';

    const result = await run({
      label: copy.confirm,
      request: {
        address: manager.address,
        abi: manager.abi,
        functionName,
        args: [claim.claimId],
      },
    });

    if (result) {
      onConfirmed?.();
      onClose();
    }
  };

  return (
    <ConfirmActionDialog
      open={open}
      onClose={onClose}
      onConfirm={handleConfirm}
      title={copy.title}
      description={`Claim ${shortHash(claim.claimId, 8)}`}
      confirmLabel={copy.confirm}
      tone={copy.tone}
      isBusy={isBusy}
      warning={copy.warning?.(claim)}
    >
      <div className="rounded-card border-border bg-surface-muted/40 border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-muted text-xs font-medium">Amount</span>
          <StatusBadge status={claim.status} compact />
        </div>
        <p className="tabular text-ink-primary mt-1 text-2xl font-semibold">
          {formatToken(claim.amount)}{' '}
          <span className="text-ink-muted text-sm font-medium">mUSDC</span>
        </p>
        <dl className="mt-3 grid gap-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Recipient</dt>
            <dd>
              <AddressText address={claim.recipient} className="text-xs" />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Claim ID</dt>
            <dd>
              <HashText hash={claim.claimId} copy={false} />
            </dd>
          </div>
        </dl>
      </div>

      <div className="text-ink-secondary flex items-start gap-2.5 text-[13px] leading-5">
        <AlertTriangle className="text-warning mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{copy.body(claim)}</p>
      </div>
    </ConfirmActionDialog>
  );
}
