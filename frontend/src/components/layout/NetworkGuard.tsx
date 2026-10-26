import { useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useConnection, useSwitchChain } from 'wagmi';
import { CHAIN_ID, chain } from '@/lib/chain';
import { describeError } from '@/lib/errors';
import { switchToClaimFlowNetwork } from '@/lib/wallet';
import { Button } from '@/components/ui/Button';

export function NetworkGuard() {
  const { isConnected, chainId, connector } = useConnection();
  const { mutateAsync: switchChain } = useSwitchChain();
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isConnected || chainId === CHAIN_ID) return null;

  const handleSwitch = async () => {
    setError(null);
    setIsSwitching(true);
    try {
      await switchToClaimFlowNetwork({
        connector,
        switchChain: (args) => switchChain(args),
      });
    } catch (switchError) {
      setError(describeError(switchError).message);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div
      className="rounded-card border-danger-border bg-danger-bg mb-5 flex flex-col gap-3 border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="text-danger mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="text-ink-secondary text-[13px] leading-5">
          <p className="text-danger font-semibold">Wrong network</p>
          <p>
            Your wallet is on chain {chainId}. ClaimFlow transactions require {chain.name} (chain{' '}
            {CHAIN_ID}). Read-only data still comes from the configured RPC.
          </p>
          {error ? <p className="text-danger mt-1 text-xs">{error}</p> : null}
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="danger"
        onClick={() => void handleSwitch()}
        disabled={isSwitching}
        className="shrink-0"
      >
        {isSwitching ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isSwitching ? 'Switching…' : 'Switch network'}
      </Button>
    </div>
  );
}
