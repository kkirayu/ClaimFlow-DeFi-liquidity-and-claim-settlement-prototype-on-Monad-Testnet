import { useState } from 'react';
import { useConnection } from 'wagmi';
import { AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorState, InlineNotice, Skeleton } from '@/components/ui/Feedback';
import { AmountInput } from '@/components/data-display/AmountInput';
import { TransactionState } from '@/components/transactions/TransactionState';
import { useTransaction } from '@/components/transactions/TransactionProvider';
import { ConnectInlineButton } from '@/components/wallet/ConnectInlineButton';
import { useLpPosition, usePoolSnapshot } from '@/hooks/useProtocol';
import { requireProtocol, SHARE_SYMBOL, TOKEN_SYMBOL } from '@/lib/contracts';
import { previewWithdrawAssets } from '@/lib/liquidity';
import { formatToken, formatTokenExact, parseTokenInput } from '@/lib/format';
import { readErrorMessage } from '@/lib/errors';

export function WithdrawPanel() {
  const { address, isConnected } = useConnection();
  const pool = usePoolSnapshot();
  const position = useLpPosition(address);
  const { run, isBusy } = useTransaction();
  const { vault } = requireProtocol();
  const [shares, setShares] = useState('');
  const [attempted, setAttempted] = useState(false);

  const parsed = shares.trim() ? parseTokenInput(shares) : null;
  const exceedsShares = parsed?.ok && position.data ? parsed.value > position.data.shares : false;
  const available = pool.data?.available;
  const noLiquidity = available === 0n;

  const estimate =
    parsed?.ok && pool.data
      ? previewWithdrawAssets(parsed.value, pool.data.totalShares, pool.data.available)
      : undefined;

  const error = attempted
    ? !parsed
      ? `Enter ${SHARE_SYMBOL} shares to redeem.`
      : !parsed.ok
        ? parsed.error
        : exceedsShares
          ? `You hold ${formatToken(position.data?.shares)} ${SHARE_SYMBOL} shares.`
          : undefined
    : parsed && !parsed.ok
      ? parsed.error
      : undefined;

  const handleWithdraw = async () => {
    setAttempted(true);
    if (!parsed?.ok || exceedsShares || noLiquidity) return;

    const result = await run({
      label: `Withdraw ${formatToken(parsed.value)} ${SHARE_SYMBOL} shares`,
      request: {
        address: vault.address,
        abi: vault.abi,
        functionName: 'withdraw',
        args: [parsed.value],
      },
    });
    if (result) {
      setShares('');
      setAttempted(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Withdraw liquidity"
        description="Redeem shares against available liquidity. Reserved funds are never withdrawable."
      />
      <CardContent className="space-y-4 pt-4">
        {!isConnected ? (
          <div className="rounded-card border-border bg-surface-muted/30 border border-dashed px-4 py-5 text-center">
            <p className="text-ink-primary text-sm font-semibold">Connect a wallet to withdraw</p>
            <p className="text-ink-secondary mx-auto mt-1 max-w-sm text-[13px] leading-5">
              Only the wallet holding pool shares can redeem them. Reservations can temporarily
              reduce the redeemable value.
            </p>
            <ConnectInlineButton
              className="mt-4 flex justify-center"
              label="Connect wallet"
              variant="outline"
            />
          </div>
        ) : position.error ? (
          <ErrorState
            title="Wallet position unavailable"
            message={readErrorMessage(position.error).message}
            onRetry={() => void position.refetch()}
          />
        ) : (
          <>
            <div className="rounded-card border-border bg-surface-muted/40 border px-3.5 py-3">
              <p className="text-ink-muted text-[11px] font-medium">Your pool shares</p>
              {position.isPending || !position.data ? (
                <Skeleton className="mt-1 h-5 w-28" />
              ) : (
                <p className="tabular text-ink-primary mt-0.5 text-sm font-semibold">
                  {formatToken(position.data.shares)} {SHARE_SYMBOL}
                </p>
              )}
            </div>

            {noLiquidity ? (
              <InlineNotice tone="danger" title="No available liquidity to withdraw">
                Reserved funds cannot be withdrawn. Try again after claims are settled or released.
              </InlineNotice>
            ) : null}

            {pool.data && pool.data.reserved > 0n ? (
              <InlineNotice tone="warning">
                <span className="inline-flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {formatToken(pool.data.reserved)} {TOKEN_SYMBOL} is reserved for claims and is not
                  available to withdraw. Withdrawals are priced on available liquidity only.
                </span>
              </InlineNotice>
            ) : null}

            <AmountInput
              id="withdraw-shares"
              label="Shares to redeem"
              value={shares}
              onChange={setShares}
              onMax={
                position.data && position.data.shares > 0n
                  ? () => setShares(formatTokenExact(position.data?.shares))
                  : undefined
              }
              maxLabel="Max"
              suffix={SHARE_SYMBOL}
              error={error}
              hint={
                position.data ? (
                  <span>
                    You hold {formatToken(position.data.shares)} {SHARE_SYMBOL} shares
                  </span>
                ) : undefined
              }
              disabled={noLiquidity || isBusy || position.isPending}
              required
            />

            <div className="rounded-card border-border bg-surface-muted/40 border px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-ink-secondary text-[13px]">Estimated mUSDC received</span>
                <span className="tabular text-ink-primary text-sm font-semibold">
                  {estimate !== undefined ? `${formatToken(estimate)} ${TOKEN_SYMBOL}` : '—'}
                </span>
              </div>
              <p className="text-ink-muted mt-1 text-[11px] leading-4">
                Based on available liquidity at the current share price, not the vault's total
                balance.
              </p>
            </div>

            <Button
              type="button"
              className="w-full"
              variant="outline"
              onClick={() => void handleWithdraw()}
              isLoading={isBusy}
              loadingLabel="Waiting for wallet…"
              disabled={
                noLiquidity ||
                position.isPending ||
                (position.data?.shares ?? 0n) === 0n ||
                (attempted && (!parsed?.ok || exceedsShares))
              }
            >
              {position.data?.shares === 0n ? 'No shares to withdraw' : 'Withdraw liquidity'}
            </Button>

            <TransactionState compact />

            <p className="text-ink-muted flex items-start gap-2 text-[11px] leading-4">
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              Withdrawals cannot touch reserved tokens. The contract computes assets from
              availableLiquidity() at execution time.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
