import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleSlash,
  Droplets,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { WalletButton } from '@/components/wallet/WalletButton';
import { Button, buttonStyles } from '@/components/ui/Button';
import { shortAddress, formatToken } from '@/lib/format';
import { useLpPosition } from '@/hooks/useProtocol';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import type { AuthStatus } from '@/lib/auth';
import { ROLE_DEFINITIONS, type RoleKey, type RolesState } from '@/lib/roles';
import { NETWORK_LABEL } from '@/lib/chain';
import { cn } from '@/lib/cn';

const ROLE_FLAGS: Record<RoleKey, keyof RolesState> = {
  operator: 'isOperator',
  approver: 'isApprover',
  settler: 'isSettler',
  canceller: 'isCanceller',
  admin: 'isAdmin',
};

const STATUS_COPY: Record<AuthStatus, { label: string; tone: string; hint: string }> = {
  disconnected: {
    label: 'Not signed in',
    tone: 'bg-surface-muted text-ink-secondary',
    hint: 'Connect a wallet to load your roles.',
  },
  'wrong-network': {
    label: 'Wrong network',
    tone: 'bg-danger-bg text-danger',
    hint: 'Switch networks before signing transactions.',
  },
  checking: {
    label: 'Checking roles',
    tone: 'bg-info-bg text-info',
    hint: 'Reading permissions from ClaimManager.',
  },
  unavailable: {
    label: 'Verification failed',
    tone: 'bg-warning-bg text-warning',
    hint: 'Permissions could not be read. Retry before acting.',
  },
  ready: {
    label: 'Role verified',
    tone: 'bg-success-bg text-success',
    hint: 'Permissions are read from the contract at this moment.',
  },
};

export function UserPage() {
  const auth = useWalletAuth();
  const position = useLpPosition(auth.address);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!auth.isConnected || !auth.address) {
    return (
      <section className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-16 sm:px-8">
        <div className="card w-full p-8 text-center sm:p-10">
          <span className="bg-primary-soft text-primary mx-auto grid h-12 w-12 place-items-center rounded-xl">
            <Wallet className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Sign in with your wallet</h1>
          <p className="text-ink-secondary mt-3 text-sm leading-6">
            ClaimFlow authenticates you through your wallet connection and reads your permissions
            directly from the ClaimManager contract. No password or account is stored.
          </p>
          <WalletButton className="mt-6 inline-block" />
          <div className="mt-6">
            <Link to="/" className="link text-sm">
              Return home
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const activeRoles = ROLE_DEFINITIONS.filter((definition) =>
    Boolean(auth.effectiveRoles[ROLE_FLAGS[definition.key]]),
  );
  const statusCopy = STATUS_COPY[auth.status];

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await auth.rolesQuery.refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="bg-canvas min-h-screen">
      <header className="border-border bg-surface border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            ClaimFlow
          </Link>
          <WalletButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-primary text-xs font-semibold uppercase tracking-[0.12em]">
              Your account
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mono text-ink-secondary mt-2">{shortAddress(auth.address, 8)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Refresh roles
            </Button>
            <Link to="/dashboard" className={buttonStyles({ size: 'sm' })}>
              Open workspace <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Account overview">
          <article className="card p-5">
            <Droplets className="text-primary h-5 w-5" aria-hidden="true" />
            <p className="text-ink-secondary mt-4 text-sm font-medium">Liquidity position</p>
            <p className="tabular mt-1 text-2xl font-semibold">
              {position.data ? `${formatToken(position.data.shareValue)} mUSDC` : '—'}
            </p>
            <p className="text-ink-muted mt-1 text-xs">Current value of your vault shares</p>
          </article>
          <article className="card p-5">
            <Wallet className="text-primary h-5 w-5" aria-hidden="true" />
            <p className="text-ink-secondary mt-4 text-sm font-medium">Available test balance</p>
            <p className="tabular mt-1 text-2xl font-semibold">
              {position.data ? `${formatToken(position.data.balance)} mUSDC` : '—'}
            </p>
            <p className="text-ink-muted mt-1 text-xs">Wallet balance available to deposit</p>
          </article>
          <article className="card p-5">
            <ShieldCheck className="text-primary h-5 w-5" aria-hidden="true" />
            <p className="text-ink-secondary mt-4 text-sm font-medium">Protocol access</p>
            <p className="mt-1 text-2xl font-semibold">
              {auth.status === 'checking' ? '…' : activeRoles.length || 'Viewer'}
            </p>
            <p className="text-ink-muted mt-1 text-xs">
              {activeRoles.length
                ? activeRoles.map((role) => role.label).join(' · ')
                : 'No operational role assigned'}
            </p>
          </article>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Session &amp; permissions</h2>
                <p className="text-ink-muted mt-1 text-xs">
                  Authentication is your wallet connection. Authorization is the on-chain role set.
                </p>
              </div>
              <span
                className={cn(
                  'rounded-badge px-2.5 py-1 text-[11px] font-semibold',
                  statusCopy.tone,
                )}
                role="status"
              >
                {statusCopy.label}
              </span>
            </div>

            <dl className="border-border mt-5 grid gap-4 border-t pt-5 sm:grid-cols-3">
              <div>
                <dt className="text-ink-muted text-[11px] font-semibold uppercase tracking-[0.08em]">
                  Network
                </dt>
                <dd className="text-ink-primary mt-1 text-sm font-medium">{NETWORK_LABEL}</dd>
              </div>
              <div>
                <dt className="text-ink-muted text-[11px] font-semibold uppercase tracking-[0.08em]">
                  Address
                </dt>
                <dd className="mono text-ink-primary mt-1 text-sm">
                  {shortAddress(auth.address, 6)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted text-[11px] font-semibold uppercase tracking-[0.08em]">
                  Source of truth
                </dt>
                <dd className="text-ink-primary mt-1 text-sm font-medium">ClaimManager roles</dd>
              </div>
            </dl>

            {auth.status === 'unavailable' ? (
              <div className="border-warning-border bg-warning-bg mt-4 flex items-start gap-2 rounded-lg border p-3">
                <ShieldAlert className="text-warning mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="text-[12px] leading-5">
                  <p className="text-warning font-semibold">Role verification failed</p>
                  <p className="text-ink-secondary">
                    Privileged actions stay disabled until the role read succeeds.{' '}
                    <button type="button" onClick={auth.retryRoles} className="link">
                      Retry now
                    </button>
                  </p>
                </div>
              </div>
            ) : null}

            <ul className="mt-6 space-y-2">
              {ROLE_DEFINITIONS.map((definition) => {
                const granted = Boolean(auth.effectiveRoles[ROLE_FLAGS[definition.key]]);
                return (
                  <li
                    key={definition.key}
                    className="border-border flex items-start justify-between gap-4 rounded-lg border px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{definition.label}</p>
                      <p className="text-ink-muted mt-0.5 text-xs leading-5">
                        {definition.description}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold',
                        granted ? 'text-success' : 'text-ink-muted',
                      )}
                    >
                      {granted ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <CircleSlash className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {granted ? 'Granted' : 'Not granted'}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-ink-muted mt-4 text-[11px] leading-5">
              {statusCopy.hint} The contract re-checks every role when a transaction executes, so UI
              state can never grant access on its own.
            </p>
          </div>

          <div className="space-y-5">
            <section className="card p-6">
              <div className="flex items-start gap-3">
                <span className="bg-success-bg text-success grid h-9 w-9 shrink-0 place-items-center rounded-lg">
                  <Activity className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold">Next actions</h2>
                  <p className="text-ink-secondary mt-1 text-sm leading-6">
                    Actions unlock automatically when your wallet holds the matching role.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Link to="/liquidity" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                  Manage liquidity
                </Link>
                <Link to="/claims" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                  {auth.canSubmitClaims ? 'Create or review claims' : 'Review claims (read-only)'}
                </Link>
                <Link to="/settlement" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                  {auth.canSettleClaims ? 'Settle approved claims' : 'Settlement queue (read-only)'}
                </Link>
              </div>
            </section>

            <section className="rounded-card bg-sidebar p-5 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/55">
                Wrong wallet?
              </p>
              <p className="mt-2 text-[13px] leading-6 text-white/70">
                Disconnect in the wallet menu, then connect the wallet that holds the role you need.
                Roles are never cached across wallets.
              </p>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
