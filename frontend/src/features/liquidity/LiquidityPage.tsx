import { Link } from 'react-router-dom';
import { useConnection } from 'wagmi';
import { ArrowRight, Coins, LockKeyhole, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { MetricCard } from '@/components/data-display/MetricCard';
import { MetricSkeleton, ErrorState } from '@/components/ui/Feedback';
import { buttonStyles } from '@/components/ui/Button';
import { LiquidityBreakdown } from '@/components/data-display/LiquidityBreakdown';
import { useLpPosition, usePoolSnapshot } from '@/hooks/useProtocol';
import { formatPercentBps, formatToken, formatUtilization } from '@/lib/format';
import { shareOfPoolBps } from '@/lib/liquidity';
import { readErrorMessage } from '@/lib/errors';
import { SHARE_SYMBOL } from '@/lib/contracts';
import { DepositPanel } from './DepositPanel';
import { WithdrawPanel } from './WithdrawPanel';

export function LiquidityPage() {
  const { address, isConnected } = useConnection();
  const pool = usePoolSnapshot();
  const position = useLpPosition(address);

  const pooledShareBps =
    position.data && pool.data ? shareOfPoolBps(position.data.shares, pool.data.totalShares) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Liquidity"
        description="Provide demo liquidity, track pool shares, and withdraw only from liquidity that is not reserved for claims."
        actions={
          <Link to="/settlement" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
            Review settlement queue
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        }
      />

      {pool.error ? (
        <ErrorState
          title="Liquidity data unavailable"
          message={readErrorMessage(pool.error).message}
          onRetry={() => void pool.refetch()}
        />
      ) : (
        <>
          <section aria-label="Liquidity summary" className="grid gap-4 sm:grid-cols-3">
            {pool.isPending || !pool.data ? (
              <>
                <MetricSkeleton />
                <MetricSkeleton />
                <MetricSkeleton />
              </>
            ) : (
              <>
                <MetricCard
                  label="Available to withdraw"
                  value={`${formatToken(pool.data.available)} mUSDC`}
                  hint="Pool-wide liquidity not reserved for claims"
                  icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
                  tone="available"
                />
                <MetricCard
                  label="Reserved for claims"
                  value={`${formatToken(pool.data.reserved)} mUSDC`}
                  hint={`${formatUtilization(pool.data.reserved, pool.data.totalAssets)} of vault balance`}
                  icon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}
                  tone="reserved"
                />
                <MetricCard
                  label="Your pool shares"
                  value={
                    isConnected ? (
                      position.data ? (
                        `${formatToken(position.data.shares)} ${SHARE_SYMBOL}`
                      ) : (
                        <span className="text-ink-muted text-xl">Loading…</span>
                      )
                    ) : (
                      <span className="text-ink-muted text-xl">Connect wallet</span>
                    )
                  }
                  hint={
                    position.data
                      ? `≈ ${formatToken(position.data.shareValue)} mUSDC at current available price${
                          pooledShareBps !== null
                            ? ` · ${formatPercentBps(pooledShareBps)} of pool`
                            : ''
                        }`
                      : 'Estimated value is based on available liquidity'
                  }
                  icon={<Coins className="h-4 w-4" aria-hidden="true" />}
                />
              </>
            )}
          </section>

          {pool.data ? (
            <LiquidityBreakdown
              balance={pool.data.totalAssets}
              available={pool.data.available}
              reserved={pool.data.reserved}
            />
          ) : null}
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <DepositPanel />
        <WithdrawPanel />
      </div>
    </div>
  );
}
