import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  LogOut,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { useConnect, useConnectors, useConnection, useDisconnect, useSwitchChain } from 'wagmi';
import { CHAIN_ID, chain } from '@/lib/chain';
import { describeError } from '@/lib/errors';
import { shortAddress } from '@/lib/format';
import { copyText } from '@/components/ui/CopyButton';
import { switchToClaimFlowNetwork } from '@/lib/wallet';
import { cn } from '@/lib/cn';

export function WalletButton({ className }: { className?: string }) {
  const { address, isConnected, chainId, connector } = useConnection();
  const connectors = useConnectors();
  const { mutateAsync: connectAsync, isPending: isConnecting } = useConnect();
  const { mutateAsync: disconnectAsync } = useDisconnect();
  const { mutateAsync: switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleConnect = async () => {
    setError(null);
    const target = connectors[0];
    if (!target) {
      setError(
        'No injected EVM wallet was detected. Install or enable a browser wallet, then refresh.',
      );
      setOpen(true);
      return;
    }
    try {
      await connectAsync({ connector: target });
      setOpen(false);
    } catch (connectError) {
      setError(describeError(connectError).message);
      setOpen(true);
    }
  };

  const handleSwitch = async () => {
    setError(null);
    try {
      await switchToClaimFlowNetwork({
        connector,
        switchChain: (args) => switchChainAsync(args),
      });
      setOpen(false);
    } catch (switchError) {
      setError(describeError(switchError).message);
    }
  };

  const handleDisconnect = async () => {
    setOpen(false);
    setError(null);
    try {
      await disconnectAsync();
    } catch (disconnectError) {
      setError(describeError(disconnectError).message);
    }
  };

  const wrongNetwork = isConnected && chainId !== CHAIN_ID;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {isConnected && address ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
          className={cn(
            'rounded-field bg-surface inline-flex h-10 items-center gap-2 border px-3 text-sm font-medium shadow-sm transition-colors',
            wrongNetwork
              ? 'border-danger-border text-danger hover:bg-danger-bg'
              : 'border-border-strong text-ink-secondary hover:border-primary/40 hover:text-primary',
          )}
        >
          <span
            className={cn('h-2 w-2 rounded-full', wrongNetwork ? 'bg-danger' : 'bg-success')}
            aria-hidden="true"
          />
          <span className="tabular hidden sm:inline">{shortAddress(address)}</span>
          <span className="sm:hidden">Wallet</span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleConnect()}
          disabled={isConnecting}
          aria-expanded={error ? true : undefined}
          className="rounded-field bg-primary hover:bg-primary-hover inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap px-3.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-70"
        >
          {isConnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Wallet className="h-4 w-4" aria-hidden="true" />
          )}
          {isConnecting ? 'Connecting…' : 'Connect wallet'}
        </button>
      )}

      {open ? (
        <div
          role="menu"
          className="animate-slide-in rounded-card border-border bg-surface shadow-pop absolute right-0 z-50 mt-2 w-[min(320px,calc(100vw-2rem))] overflow-hidden border"
        >
          {isConnected && address ? (
            <>
              <div className="border-border border-b px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted text-[11px] font-semibold uppercase tracking-[0.06em]">
                    Connected wallet
                  </span>
                  <span className="text-success inline-flex items-center gap-1 text-[11px] font-medium">
                    <span className="bg-success h-1.5 w-1.5 rounded-full" aria-hidden="true" />
                    Active
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="mono text-ink-primary text-xs">{shortAddress(address, 6)}</span>
                  <button
                    type="button"
                    className="text-ink-muted hover:bg-surface-muted hover:text-primary inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px]"
                    onClick={async () => {
                      if (await copyText(address)) setCopied(true);
                    }}
                  >
                    {copied ? (
                      <Check className="text-success h-3 w-3" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3 w-3" aria-hidden="true" />
                    )}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="space-y-1 px-2 py-2">
                <div className="flex items-center justify-between rounded-md px-2 py-2 text-[13px]">
                  <span className="text-ink-muted">Network</span>
                  <span
                    className={cn('font-medium', wrongNetwork ? 'text-danger' : 'text-ink-primary')}
                  >
                    {wrongNetwork ? `Chain ${chainId}` : chain.name}
                  </span>
                </div>
                {wrongNetwork ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleSwitch()}
                    disabled={isSwitching}
                    className="text-primary hover:bg-primary-soft flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-medium disabled:opacity-60"
                  >
                    {isSwitching ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    )}
                    {isSwitching ? 'Switching…' : `Switch to ${chain.name}`}
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleDisconnect()}
                  className="text-ink-secondary hover:bg-surface-muted hover:text-danger flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-medium"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Disconnect
                </button>
              </div>
            </>
          ) : null}

          {error ? (
            <div className="border-danger-border bg-danger-bg border-t px-4 py-3">
              <p className="text-danger flex items-start gap-2 text-xs leading-5" role="alert">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
