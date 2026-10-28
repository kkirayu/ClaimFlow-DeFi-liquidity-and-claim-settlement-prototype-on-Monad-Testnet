import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Hex } from 'viem';
import { ArrowLeft, Ban, Check, CircleSlash, Send, ShieldCheck, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { CopyButton } from '@/components/ui/CopyButton';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { AddressText, HashText, TxLink } from '@/components/data-display/AddressText';
import { RoleBadges } from '@/components/data-display/RoleBadges';
import { Timeline } from '@/components/data-display/Timeline';
import { ConnectInlineButton } from '@/components/wallet/ConnectInlineButton';
import { TransactionState } from '@/components/transactions/TransactionState';
import { ClaimActionDialog } from './ClaimActionDialog';
import { useClaim, useClaimEvents, usePoolSnapshot } from '@/hooks/useProtocol';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { isBytes32 } from '@/lib/claimForm';
import { STATUS_META, ClaimStatus, availableClaimActions, type ClaimAction } from '@/lib/claims';
import { ZERO_HASH } from '@/lib/contracts';
import { branchLabel, categoryLabel } from '@/lib/labels';
import { formatDateTime, formatRelativeTime, formatToken } from '@/lib/format';
import { readErrorMessage } from '@/lib/errors';

const ACTION_META: Record<
  ClaimAction,
  { label: string; icon: typeof Check; variant: 'primary' | 'danger' | 'success' | 'outline' }
> = {
  approve: { label: 'Approve & reserve', icon: Check, variant: 'primary' },
  reject: { label: 'Reject claim', icon: X, variant: 'danger' },
  cancel: { label: 'Cancel claim', icon: Ban, variant: 'outline' },
  'cancel-release': { label: 'Cancel & release reservation', icon: Ban, variant: 'outline' },
  settle: { label: 'Settle payout', icon: Send, variant: 'success' },
};

function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <div className="card p-6">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-4 h-10 w-52" />
        <Skeleton className="mt-4 h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="card p-6">
          <Skeleton className="h-5 w-32" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="card p-6">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-4 h-20 w-full" />
        </div>
      </div>
    </div>
  );
}

export function ClaimDetailPage() {
  const { claimId: rawClaimId } = useParams();
  const auth = useWalletAuth();
  const normalizedId = rawClaimId?.trim();
  const claimId = normalizedId && isBytes32(normalizedId) ? (normalizedId as Hex) : undefined;
  const claim = useClaim(claimId);
  const events = useClaimEvents(claimId);
  const pool = usePoolSnapshot();
  const roleFlags = auth.effectiveRoles;
  const [action, setAction] = useState<ClaimAction | null>(null);

  if (rawClaimId && !claimId) {
    return (
      <div className="space-y-5">
        <PageHeader title="Claim detail" description="The requested claim ID is not valid." />
        <Card>
          <EmptyState
            title="Invalid claim ID"
            description="Claim IDs are 32-byte values: 0x followed by 64 hexadecimal characters."
            action={
              <Link to="/claims" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                Back to claims
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  if (claim.isPending) return <DetailSkeleton />;

  if (claim.error) {
    return (
      <div className="space-y-5">
        <PageHeader title="Claim detail" />
        <ErrorState
          title="Claim could not be loaded"
          message={readErrorMessage(claim.error).message}
          onRetry={() => void claim.refetch()}
        />
      </div>
    );
  }

  if (!claim.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Claim detail" />
        <Card>
          <EmptyState
            title="Claim not found"
            description="No claim exists with this ID on the configured ClaimManager. Check the claim ID and network."
            action={
              <Link to="/claims" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                Back to claims
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const record = claim.data;
  const actions = availableClaimActions(
    record,
    roleFlags,
    auth.address,
    pool.data?.allowSelfApproval ?? false,
  );
  const createdEvent = events.events.find((event) => event.kind === 'ClaimSubmitted');
  const terminal =
    record.status === ClaimStatus.Paid ||
    record.status === ClaimStatus.Rejected ||
    record.status === ClaimStatus.Cancelled;
  const selfApprovalBlocked =
    record.status === ClaimStatus.Pending &&
    auth.isConnected &&
    auth.address?.toLowerCase() === record.createdBy.toLowerCase() &&
    pool.data?.allowSelfApproval === false;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Claim detail"
        description="Opaque claim metadata, lifecycle state, and decoded on-chain history."
        actions={
          <Link to="/claims" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to claims
          </Link>
        }
      />

      <Card>
        <CardContent className="py-5 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={record.status} />
                <span className="text-ink-muted text-xs">
                  Last updated {formatRelativeTime(record.updatedAt)}
                </span>
              </div>

              <p className="tabular text-ink-primary mt-3 text-[32px] font-semibold leading-none tracking-[-0.02em]">
                {formatToken(record.amount)}{' '}
                <span className="text-ink-muted text-base font-medium">mUSDC</span>
              </p>

              <div className="text-ink-secondary mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-ink-muted">Recipient</span>
                  <AddressText address={record.recipient} />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-ink-muted">Created by</span>
                  <AddressText address={record.createdBy} explorer={false} />
                </span>
              </div>

              <div className="mt-3 flex items-start gap-1">
                <span
                  className="mono text-ink-muted break-all text-[11px] leading-5"
                  title={record.claimId}
                >
                  {record.claimId}
                </span>
                <CopyButton value={record.claimId} label="Copy claim ID" />
              </div>
            </div>

            <div className="rounded-card border-border bg-surface-muted/40 shrink-0 border px-4 py-3 lg:max-w-[280px]">
              <p className="text-ink-muted text-[11px] font-semibold uppercase tracking-[0.06em]">
                Status meaning
              </p>
              <p className="text-ink-secondary mt-1.5 text-[13px] leading-5">
                {STATUS_META[record.status].description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Claim information"
            description="Only opaque references and minimal numeric metadata are stored on-chain."
          />
          <CardContent className="pt-4">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-ink-muted text-[11px] font-medium uppercase tracking-[0.04em]">
                  Branch code
                </dt>
                <dd className="text-ink-primary mt-0.5 text-[13px]">
                  {branchLabel(record.branchCode)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted text-[11px] font-medium uppercase tracking-[0.04em]">
                  Category
                </dt>
                <dd className="text-ink-primary mt-0.5 text-[13px]">
                  {categoryLabel(record.categoryId)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted text-[11px] font-medium uppercase tracking-[0.04em]">
                  Created at
                </dt>
                <dd className="text-ink-primary mt-0.5 text-[13px]">
                  {formatDateTime(record.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted text-[11px] font-medium uppercase tracking-[0.04em]">
                  Last updated
                </dt>
                <dd className="text-ink-primary mt-0.5 text-[13px]">
                  {formatDateTime(record.updatedAt)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-ink-muted text-[11px] font-medium uppercase tracking-[0.04em]">
                  Reference hash
                </dt>
                <dd className="mt-0.5">
                  <HashText hash={record.claimRefHash} />
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-ink-muted text-[11px] font-medium uppercase tracking-[0.04em]">
                  Evidence hash
                </dt>
                <dd className="mt-0.5">
                  {record.evidenceHash === ZERO_HASH ? (
                    <span className="text-ink-muted text-[13px]">Not provided</span>
                  ) : (
                    <HashText hash={record.evidenceHash} />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted text-[11px] font-medium uppercase tracking-[0.04em]">
                  Created by
                </dt>
                <dd className="mt-0.5">
                  <AddressText address={record.createdBy} />
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted text-[11px] font-medium uppercase tracking-[0.04em]">
                  Created transaction
                </dt>
                <dd className="mt-0.5 text-[13px]">
                  {events.query.isPending ? (
                    <Skeleton className="h-4 w-24" />
                  ) : createdEvent ? (
                    <TxLink hash={createdEvent.txHash} />
                  ) : (
                    <span className="text-ink-muted">Event not indexed</span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Actions"
            description="Only actions your wallet can actually perform are shown. The contract remains the authority."
          />
          <CardContent className="space-y-4 pt-4">
            {!auth.isConnected ? (
              <div>
                <p className="text-ink-secondary text-[13px] leading-5">
                  Connect a wallet to see role-gated actions for this claim.
                </p>
                <ConnectInlineButton className="mt-3" label="Connect wallet" />
              </div>
            ) : terminal ? (
              <p className="text-ink-secondary text-[13px] leading-5">
                This claim is in a terminal state. No further writes are possible.
              </p>
            ) : auth.status === 'unavailable' ? (
              <ErrorState
                title="Role verification failed"
                message="Wallet permissions could not be loaded, so claim actions stay disabled. Retry before signing anything."
                onRetry={auth.retryRoles}
                className="px-4 py-4"
              />
            ) : auth.status === 'checking' ? (
              <p className="text-ink-secondary text-[13px] leading-5">Checking wallet roles…</p>
            ) : actions.length > 0 ? (
              <div className="flex flex-col gap-2">
                {actions.map((nextAction) => {
                  const meta = ACTION_META[nextAction];
                  const Icon = meta.icon;
                  return (
                    <Button
                      key={nextAction}
                      type="button"
                      variant={meta.variant}
                      className="w-full justify-start"
                      onClick={() => setAction(nextAction)}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {meta.label}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <p className="text-ink-secondary text-[13px] leading-5">
                This wallet does not hold a role available for the claim’s current state.
              </p>
            )}

            {selfApprovalBlocked ? (
              <p className="rounded-card border-warning-border bg-warning-bg text-ink-secondary border px-3 py-2 text-xs leading-5">
                Self-approval is disabled on this deployment. A different wallet holding Claim
                Approver must review this claim.
              </p>
            ) : null}

            {auth.isConnected ? (
              <div>
                <p className="text-ink-muted mb-2 text-[11px] font-semibold uppercase tracking-[0.06em]">
                  Your roles
                </p>
                <RoleBadges roles={roleFlags} />
              </div>
            ) : null}

            <div className="rounded-card border-border bg-surface-muted/40 text-ink-muted flex items-start gap-2 border px-3 py-2.5 text-[11px] leading-4">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              Payouts and role checks are enforced by the ClaimManager contract, not by this
              interface. A confirmed payout is irreversible.
            </div>

            <TransactionState compact />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Lifecycle timeline"
          description="Decoded on-chain events for this claim, newest first. Batch settlement also emits per-claim paid events."
        />
        <CardContent className="pt-4">
          {events.query.error ? (
            <ErrorState
              title="Event history unavailable"
              message={readErrorMessage(events.query.error).message}
              onRetry={() => void events.query.refetch()}
            />
          ) : events.query.isPending ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex gap-4">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-72" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.events.length === 0 ? (
            <div className="rounded-card border-border bg-surface-muted/30 text-ink-secondary flex items-center gap-3 border border-dashed px-4 py-5 text-[13px]">
              <CircleSlash className="text-ink-muted h-4 w-4" aria-hidden="true" />
              No events were returned for this claim. The current state is read directly from the
              contract; event history may be unavailable if logs are pruned.
            </div>
          ) : (
            <Timeline events={events.events} showClaimLink={false} />
          )}
        </CardContent>
      </Card>

      {action ? (
        <ClaimActionDialog claim={record} action={action} open onClose={() => setAction(null)} />
      ) : null}
    </div>
  );
}
