import { useConnection } from 'wagmi';
import { AlertTriangle, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { CHAIN_ID, CHAIN_NAME, NETWORK_LABEL } from '@/lib/chain';

export function NetworkBadge({ className }: { className?: string }) {
  const { isConnected, chainId } = useConnection();

  if (!isConnected) {
    return (
      <Badge
        tone="neutral"
        className={className}
        icon={<Circle className="text-ink-muted h-2 w-2 fill-current" aria-hidden="true" />}
      >
        {NETWORK_LABEL}
      </Badge>
    );
  }

  if (chainId !== CHAIN_ID) {
    return (
      <Badge
        tone="danger"
        className={className}
        icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
        title={`Wallet is on chain ${chainId ?? 'unknown'}; ClaimFlow expects ${CHAIN_NAME} (${CHAIN_ID}).`}
      >
        Wrong network
      </Badge>
    );
  }

  return (
    <Badge
      tone="success"
      className={className}
      icon={<Circle className="h-2 w-2 fill-current" aria-hidden="true" />}
    >
      {NETWORK_LABEL}
    </Badge>
  );
}
