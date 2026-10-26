import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useConnection } from 'wagmi';
import {
  Blocks,
  Coins,
  ExternalLink,
  FlaskConical,
  KeyRound,
  Network,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { ErrorState, InlineNotice, Skeleton } from '@/components/ui/Feedback';
import { AddressText } from '@/components/data-display/AddressText';
import { RoleBadges } from '@/components/data-display/RoleBadges';
import { ConnectInlineButton } from '@/components/wallet/ConnectInlineButton';
import { usePoolSnapshot, useRoles, useTokenInfo } from '@/hooks/useProtocol';
import {
  CHAIN_ID,
  CHAIN_NAME,
  EXPLORER_URL,
  IS_LOCAL_CHAIN,
  NETWORK_LABEL,
  PROVIDER_LABEL,
  RPC_URL,
  addresses,
  deploymentBlock,
} from '@/lib/chain';
import { ROLE_DEFINITIONS } from '@/lib/roles';
import { TOKEN_SYMBOL } from '@/lib/contracts';
import { formatInteger, formatToken } from '@/lib/format';
import { readErrorMessage } from '@/lib/errors';

function cooldownLabel(seconds: number): string {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${formatInteger(hours)} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  if (seconds % 60 === 0) return `${formatInteger(seconds / 60)} minutes`;
  return `${formatInteger(seconds)} seconds`;
}

function ContractRow({ label, address }: { label: string; address?: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-ink-secondary text-[13px] font-medium">{label}</span>
      {address ? (
        <AddressText address={address} className="text-ink-primary text-[13px]" />
      ) : (
        <span className="text-ink-muted text-[13px]">Not configured</span>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-ink-muted text-[11px] font-semibold uppercase tracking-[0.08em]">
        {label}
      </dt>
      <dd className="text-ink-primary mt-1 text-[13px] leading-5">{children}</dd>
    </div>
  );
}

export function ProtocolPage() {
  const { address, isConnected } = useConnection();
  const token = useTokenInfo();
  const pool = usePoolSnapshot();
  const roles = useRoles(address);

  const explorerHome = EXPLORER_URL ? EXPLORER_URL.replace(/\/$/, '') : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Protocol"
        description="Deployment configuration, token parameters, and the on-chain roles that gate every state change. Values are read from the configured chain."
        actions={
          <Link to="/benchmark" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            Performance Lab
          </Link>
        }
      />

      <InlineNotice tone="warning" title="Testnet prototype">
        ClaimFlow uses a mock USDC token and synthetic claim metadata. Contracts are unaudited and
        must not hold real funds or personal data. Batch settlement is irreversible once confirmed.
      </InlineNotice>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Network"
            description="The interface reads from a public RPC and asks the wallet for signatures only."
            action={
              <Badge tone={IS_LOCAL_CHAIN ? 'warning' : 'info'}>
                {IS_LOCAL_CHAIN ? 'Local' : 'Testnet'}
              </Badge>
            }
          />
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Network">
                <span className="inline-flex items-center gap-1.5">
                  <Network className="text-ink-muted h-3.5 w-3.5" aria-hidden="true" />
                  {CHAIN_NAME}
                </span>
              </Detail>
              <Detail label="Chain ID">
                <span className="tabular">{CHAIN_ID}</span>
              </Detail>
              <Detail label="RPC provider">{PROVIDER_LABEL}</Detail>
              <Detail label="Deployment block">
                <span className="tabular">{deploymentBlock.toString()}</span>
              </Detail>
              <Detail label="RPC endpoint">
                <span className="mono text-ink-secondary break-all text-[12px]">{RPC_URL}</span>
              </Detail>
              <Detail label="Explorer">
                {explorerHome ? (
                  <a
                    href={explorerHome}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    Open explorer
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-ink-muted">Not configured for this deployment</span>
                )}
              </Detail>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Contracts"
            description="Addresses come from deployment environment variables; the UI never invents them."
            action={<Blocks className="text-ink-muted h-4 w-4" aria-hidden="true" />}
          />
          <CardContent className="divide-border divide-y py-2">
            <ContractRow label={`${TOKEN_SYMBOL} token`} address={addresses.token} />
            <ContractRow label="Liquidity vault" address={addresses.vault} />
            <ContractRow label="Claim manager" address={addresses.claimManager} />
            <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-ink-secondary text-[13px] font-medium">Network label</span>
              <Badge tone="neutral">{NETWORK_LABEL}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Demo token"
            description="A capped faucet mints test tokens. Minting is rate-limited per address."
            action={<Coins className="text-ink-muted h-4 w-4" aria-hidden="true" />}
          />
          <CardContent>
            {token.error ? (
              <ErrorState
                title="Token parameters unavailable"
                message={readErrorMessage(token.error).message}
                onRetry={() => void token.refetch()}
              />
            ) : token.isPending || !token.data ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail label="Token name">{token.data.name}</Detail>
                <Detail label="Symbol">{token.data.symbol}</Detail>
                <Detail label="Decimals">
                  <span className="tabular">{token.data.decimals}</span>
                </Detail>
                <Detail label="Faucet amount">
                  <span className="tabular">
                    {formatToken(token.data.faucetAmount)} {token.data.symbol}
                  </span>
                </Detail>
                <Detail label="Faucet cooldown">{cooldownLabel(token.data.faucetCooldown)}</Detail>
                <Detail label="Lifetime faucet cap">
                  <span className="tabular">
                    {formatToken(token.data.faucetCap)} {token.data.symbol}
                  </span>
                </Detail>
              </dl>
            )}
            <div className="mt-4">
              <Link to="/liquidity" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                Get test tokens
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Your permissions"
            description="Roles are checked by the contracts. A connected wallet with no role can still read data and provide liquidity."
            action={<KeyRound className="text-ink-muted h-4 w-4" aria-hidden="true" />}
          />
          <CardContent className="space-y-4">
            {!isConnected ? (
              <div className="space-y-3">
                <p className="text-ink-secondary text-[13px] leading-5">
                  Connect a wallet to see which roles it holds on this deployment.
                </p>
                <ConnectInlineButton size="sm" />
              </div>
            ) : roles.error ? (
              <ErrorState
                title="Role check unavailable"
                message={readErrorMessage(roles.error).message}
                onRetry={() => void roles.refetch()}
                className="px-4 py-3"
              />
            ) : roles.isPending || !roles.data ? (
              <div className="flex flex-wrap gap-2">
                <Skeleton className="rounded-badge h-7 w-28" />
                <Skeleton className="rounded-badge h-7 w-28" />
                <Skeleton className="rounded-badge h-7 w-32" />
              </div>
            ) : (
              <>
                <RoleBadges roles={roles.data} showDescription />
                <p className="text-ink-muted text-xs leading-5">
                  {roles.data.isOperator ||
                  roles.data.isApprover ||
                  roles.data.isSettler ||
                  roles.data.isCanceller ||
                  roles.data.isAdmin
                    ? 'This wallet can perform at least one privileged action.'
                    : 'This wallet has no privileged roles. Liquidity provider actions remain available.'}
                </p>
              </>
            )}

            {pool.data ? (
              <div className="rounded-card border-border bg-surface-muted/50 text-ink-secondary border px-4 py-3 text-xs leading-5">
                <p className="text-ink-primary font-medium">Batch cap</p>
                <p>
                  Settle up to{' '}
                  <span className="tabular font-semibold">{pool.data.maxBatchSize.toString()}</span>{' '}
                  approved claims in one transaction.
                </p>
              </div>
            ) : null}

            {pool.data?.allowSelfApproval ? (
              <InlineNotice tone="warning" title="Self-approval enabled">
                This deployment allows a wallet to approve a claim it created. This is intended for
                single-wallet local demos only; the contract default separates the roles.
              </InlineNotice>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Access control model"
          description="Every state-changing entry point checks a role on-chain, regardless of what the interface shows."
          action={<ShieldCheck className="text-ink-muted h-4 w-4" aria-hidden="true" />}
        />
        <CardContent className="px-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3 font-semibold sm:px-6">Role</th>
                  <th className="px-5 py-3 font-semibold sm:px-6">Capabilities</th>
                  <th className="px-5 py-3 font-semibold sm:px-6">Your wallet</th>
                </tr>
              </thead>
              <tbody>
                {ROLE_DEFINITIONS.map((definition) => {
                  const granted =
                    definition.key === 'operator'
                      ? roles.data?.isOperator
                      : definition.key === 'approver'
                        ? roles.data?.isApprover
                        : definition.key === 'settler'
                          ? roles.data?.isSettler
                          : definition.key === 'canceller'
                            ? roles.data?.isCanceller
                            : roles.data?.isAdmin;
                  return (
                    <tr key={definition.key} className="border-border border-t">
                      <td className="text-ink-primary whitespace-nowrap px-5 py-3 text-[13px] font-medium sm:px-6">
                        {definition.label}
                      </td>
                      <td className="text-ink-secondary px-5 py-3 text-[13px] leading-5 sm:px-6">
                        {definition.description}
                      </td>
                      <td className="px-5 py-3 sm:px-6">
                        {!isConnected ? (
                          <span className="text-ink-muted text-xs">Connect wallet</span>
                        ) : granted ? (
                          <Badge
                            tone="success"
                            icon={<ShieldCheck className="h-3 w-3" aria-hidden="true" />}
                          >
                            Granted
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Not granted</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Safety invariants"
          description="These properties are enforced by the contracts and covered by automated tests."
          action={<TriangleAlert className="text-ink-muted h-4 w-4" aria-hidden="true" />}
        />
        <CardContent>
          <ul className="text-ink-secondary grid gap-3 text-[13px] leading-5 sm:grid-cols-2">
            <li className="flex gap-2">
              <ShieldCheck className="text-success mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Reserved liquidity can never exceed the vault token balance.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="text-success mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Approval and reservation happen in one transaction, or not at all.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="text-success mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />A
              paid claim cannot be paid again; settlement reads terminal status first.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="text-success mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />A
              batch reverts entirely if any selected claim is invalid.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="text-success mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Withdrawals are limited to liquidity that is not reserved.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="text-success mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Claim metadata is hash-only; the contracts store no personal data.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Link to="/" className={buttonStyles({ variant: 'ghost', size: 'sm', className: 'px-0' })}>
        Back to overview
      </Link>
    </div>
  );
}
