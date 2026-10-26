import { useState } from 'react';
import { useConnection } from 'wagmi';
import { BadgeCheck, Info, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, InlineNotice, Skeleton } from '@/components/ui/Feedback';
import { AmountInput } from '@/components/data-display/AmountInput';
import { TransactionState } from '@/components/transactions/TransactionState';
import { useTransaction } from '@/components/transactions/TransactionProvider';
import { ConnectInlineButton } from '@/components/wallet/ConnectInlineButton';
import { useLpPosition, usePoolSnapshot } from '@/hooks/useProtocol';
import { requireProtocol, SHARE_SYMBOL, TOKEN_SYMBOL } from '@/lib/contracts';
import { previewDepositShares } from '@/lib/liquidity';
import { formatToken, formatTokenExact, parseTokenInput } from '@/lib/format';
import { readErrorMessage } from '@/lib/errors';
import { FaucetButton } from './FaucetButton';

export function DepositPanel() {
  const { address, isConnected } = useConnection();
  const pool = usePoolSnapshot();
  const position = useLpPosition(address);
  const { run, isBusy } = useTransaction();
  const { token, vault } = requireProtocol();
  const [amount, setAmount] = useState('');
  const [attempted, setAttempted] = useState(false);

  const parsed = amount.trim() ? parseTokenInput(amount) : null;
  const exceedsBalance = parsed?.ok && position.data ? parsed.value > position.data.balance : false;
  const depositBlocked =
    pool.data !== undefined && pool.data.totalShares > 0n && pool.data.available === 0n;

  const error = attempted
    ? !parsed
      ? 'Enter an amount to deposit.'
      : !parsed.ok
        ? parsed.error
        : exceedsBalance
          ? `Wallet balance is ${formatToken(position.data?.balance)} ${TOKEN_SYMBOL}.`
          : undefined
    : parsed && !parsed.ok
      ? parsed.error
      : undefined;

  const needsApproval =
    parsed?.ok && position.data ? position.data.allowance < parsed.value : false;

  const estimate =
    parsed?.ok && pool.data
      ? previewDepositShares(parsed.value, pool.data.totalShares, pool.data.available)
      : undefined;

  const handleAction = async () => {
    setAttempted(true);
    if (!parsed?.ok || exceedsBalance || depositBlocked || !position.data) return;

    if (needsApproval) {
      await run({
        label: `Approve ${formatToken(parsed.value)} ${TOKEN_SYMBOL}`,
        request: {
          address: token.address,
          abi: token.abi,
          functionName: 'approve',
          args: [vault.address, parsed.value],
        },
      });
      return;
    }

    const result = await run({
      label: `Deposit ${formatToken(parsed.value)} ${TOKEN_SYMBOL}`,
      request: {
        address: vault.address,
        abi: vault.abi,
        functionName: 'deposit',
        args: [parsed.value],
      },
    });
    if (result) {
      setAmount('');
      setAttempted(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Deposit liquidity"
        description="Deposit mock USDC and receive pool shares priced on available liquidity."
      />
      <CardContent className="space-y-4 pt-4">
        {!isConnected ? (
          <div className="rounded-card border-border bg-surface-muted/30 border border-dashed px-4 py-5 text-center">
            <p className="text-ink-primary text-sm font-semibold">Connect a wallet to deposit</p>
            <p className="text-ink-secondary mx-auto mt-1 max-w-sm text-[13px] leading-5">
              Deposits are signed by your wallet. Read-only pool metrics remain visible without a
              wallet.
            </p>
            <ConnectInlineButton className="mt-4 flex justify-center" label="Connect wallet" />
          </div>
        ) : position.error ? (
          <ErrorState
            title="Wallet position unavailable"
            message={readErrorMessage(position.error).message}
            onRetry={() => void position.refetch()}
          />
        ) : (
          <>
            <div className="rounded-card border-border bg-surface-muted/40 flex flex-wrap items-center justify-between gap-2 border px-3.5 py-3">
              <div>
                <p className="text-ink-muted text-[11px] font-medium">Wallet balance</p>
                {position.isPending || !position.data ? (
                  <Skeleton className="mt-1 h-5 w-28" />
                ) : (
                  <p className="tabular text-ink-primary mt-0.5 text-sm font-semibold">
                    {formatToken(position.data.balance)} {TOKEN_SYMBOL}
                  </p>
                )}
              </div>
              <FaucetButton position={position.data} />
            </div>

            {depositBlocked ? (
              <InlineNotice tone="warning" title="Deposits are blocked">
                All pool liquidity is currently reserved. Deposits are unavailable while the
                available share price cannot be determined.
              </InlineNotice>
            ) : null}

            <AmountInput
              id="deposit-amount"
              label="Amount"
              value={amount}
              onChange={setAmount}
              onMax={
                position.data && position.data.balance > 0n
                  ? () => setAmount(formatTokenExact(position.data?.balance))
                  : undefined
              }
              maxLabel="Max"
              error={error}
              hint={
                position.data ? (
                  <span>
                    Available wallet balance: {formatToken(position.data.balance)} {TOKEN_SYMBOL}
                  </span>
                ) : undefined
              }
              disabled={depositBlocked || isBusy || position.isPending}
              required
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-ink-secondary">Estimated pool shares</span>
                <span className="tabular text-ink-primary font-medium">
                  {estimate !== undefined ? `${formatToken(estimate)} ${SHARE_SYMBOL}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-ink-secondary">Approval</span>
                {position.data ? (
                  needsApproval && parsed?.ok ? (
                    <Badge tone="warning">Approval required</Badge>
                  ) : (
                    <Badge
                      tone="success"
                      icon={<BadgeCheck className="h-3 w-3" aria-hidden="true" />}
                    >
                      Allowance sufficient
                    </Badge>
                  )
                ) : (
                  <Skeleton className="h-5 w-24" />
                )}
              </div>
              {position.data && position.data.allowance > 0n ? (
                <p className="text-ink-muted text-[11px] leading-4">
                  Current vault allowance: {formatToken(position.data.allowance)} {TOKEN_SYMBOL}.
                </p>
              ) : null}
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={() => void handleAction()}
              isLoading={isBusy}
              loadingLabel="Waiting for wallet…"
              disabled={
                depositBlocked ||
                position.isPending ||
                (attempted && (!parsed?.ok || exceedsBalance))
              }
            >
              {needsApproval ? `Approve ${TOKEN_SYMBOL}` : 'Deposit liquidity'}
            </Button>

            <TransactionState compact />

            <p className="text-ink-muted flex items-start gap-2 text-[11px] leading-4">
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              Pool shares represent a claim on available liquidity. Claim reservations can reduce
              the withdrawable value per share. MVP tokens are simulated and provide no yield.
            </p>
            <p className="text-ink-muted flex items-start gap-2 text-[11px] leading-4">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              The contract transfers only after allowance is set; this flow requests the exact
              deposit amount.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
