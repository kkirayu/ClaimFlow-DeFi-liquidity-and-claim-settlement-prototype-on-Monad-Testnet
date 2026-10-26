import { Droplets, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTransaction } from '@/components/transactions/TransactionProvider';
import { useNowSeconds, useTokenInfo, type LpPosition } from '@/hooks/useProtocol';
import { requireProtocol } from '@/lib/contracts';
import { formatCountdown } from '@/lib/format';

export function FaucetButton({
  position,
  disabled = false,
  className,
}: {
  position?: LpPosition;
  disabled?: boolean;
  className?: string;
}) {
  const now = useNowSeconds();
  const tokenInfo = useTokenInfo();
  const { run, isBusy } = useTransaction();
  const { token } = requireProtocol();

  if (!position) {
    return (
      <Button type="button" variant="outline" size="sm" disabled className={className}>
        <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
        Faucet
      </Button>
    );
  }

  const capReached =
    tokenInfo.data !== undefined && position.faucetMinted >= tokenInfo.data.faucetCap;
  const onCooldown = position.faucetAvailableAt > now;
  const isDisabled = disabled || isBusy || capReached || onCooldown;

  const label = capReached
    ? 'Faucet cap reached'
    : onCooldown
      ? `Faucet ${formatCountdown(position.faucetAvailableAt, now * 1000)}`
      : 'Get 100,000 mUSDC';

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={isDisabled}
      onClick={() =>
        void run({
          label: 'Request demo mUSDC from faucet',
          request: {
            address: token.address,
            abi: token.abi,
            functionName: 'faucet',
          },
        })
      }
      title={
        onCooldown
          ? `Faucet available ${formatCountdown(position.faucetAvailableAt, now * 1000)}. Cooldown is one hour.`
          : 'One request per wallet per hour, capped lifetime amount.'
      }
    >
      {isBusy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {label}
    </Button>
  );
}
