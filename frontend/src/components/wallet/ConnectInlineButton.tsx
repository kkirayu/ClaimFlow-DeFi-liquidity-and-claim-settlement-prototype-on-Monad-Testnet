import { useState } from 'react';
import { useConnect, useConnectors } from 'wagmi';
import { Loader2, Wallet } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/Button';
import { describeError } from '@/lib/errors';

/** Small inline connect action for panels where the global wallet menu is out of reach. */
export function ConnectInlineButton({
  label = 'Connect wallet',
  variant = 'primary',
  size = 'md',
  className,
}: {
  label?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}) {
  const connectors = useConnectors();
  const { mutateAsync, isPending } = useConnect();
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    const connector = connectors[0];
    if (!connector) {
      setError(
        'No injected EVM wallet detected. Install or enable a browser wallet, then refresh.',
      );
      return;
    }
    try {
      await mutateAsync({ connector });
    } catch (connectError) {
      setError(describeError(connectError).message);
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => void handleConnect()}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Wallet className="h-4 w-4" aria-hidden="true" />
        )}
        {isPending ? 'Connecting…' : label}
      </Button>
      {error ? (
        <p className="text-danger mt-2 text-xs leading-5" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
