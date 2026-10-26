import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useConnection } from 'wagmi';
import { Ban, Check, Eye, Plus, Search, Send, SlidersHorizontal, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, InlineNotice, Skeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Input';
import { TableContainer, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { AddressText } from '@/components/data-display/AddressText';
import { NewClaimDialog } from './NewClaimDialog';
import { ClaimActionDialog } from './ClaimActionDialog';
import { useClaims, usePoolSnapshot, useRoles } from '@/hooks/useProtocol';
import {
  STATUS_OPTIONS,
  availableClaimActions,
  filterClaims,
  type ClaimAction,
  type ClaimFilterState,
  type ClaimRecord,
  type ClaimStatusFilter,
} from '@/lib/claims';
import { BRANCH_OPTIONS, CATEGORY_OPTIONS, branchLabel, categoryLabel } from '@/lib/labels';
import { EMPTY_ROLES } from '@/lib/roles';
import { CHAIN_ID } from '@/lib/chain';
import {
  formatDateTime,
  formatInteger,
  formatRelativeTime,
  formatToken,
  shortHash,
} from '@/lib/format';
import { readErrorMessage } from '@/lib/errors';

const VALID_STATUSES = new Set(['all', '1', '2', '3', '4', '5']);

function readFilters(params: URLSearchParams): ClaimFilterState {
  const status = params.get('status') ?? 'all';
  return {
    status: (VALID_STATUSES.has(status) ? status : 'all') as ClaimStatusFilter,
    category: params.get('category') ?? 'all',
    branch: params.get('branch') ?? 'all',
    search: params.get('q') ?? '',
    sort: params.get('sort') === 'amount' ? 'amount' : 'newest',
  };
}

function ClaimsSkeleton() {
  return (
    <div className="space-y-3 px-5 py-5 sm:px-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto h-4 w-20" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function RowActions({
  claim,
  actions,
  onAction,
}: {
  claim: ClaimRecord;
  actions: ClaimAction[];
  onAction: (claim: ClaimRecord, action: ClaimAction) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Link
        to={`/claims/${claim.claimId}`}
        className="text-primary hover:bg-primary-soft inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium"
        aria-label={`View claim ${shortHash(claim.claimId)}`}
      >
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        View
      </Link>
      {actions.includes('approve') ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-success h-8 px-2"
          onClick={() => onAction(claim, 'approve')}
          aria-label="Approve and reserve claim"
          title="Approve & reserve"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      ) : null}
      {actions.includes('reject') ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-danger h-8 px-2"
          onClick={() => onAction(claim, 'reject')}
          aria-label="Reject claim"
          title="Reject"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      ) : null}
      {actions.includes('cancel') ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-warning h-8 px-2"
          onClick={() => onAction(claim, 'cancel')}
          aria-label="Cancel claim"
          title="Cancel"
        >
          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      ) : null}
      {actions.includes('cancel-release') ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-warning h-8 px-2"
          onClick={() => onAction(claim, 'cancel-release')}
          aria-label="Cancel and release reservation"
          title="Cancel & release"
        >
          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      ) : null}
      {actions.includes('settle') ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-success h-8 px-2"
          onClick={() => onAction(claim, 'settle')}
          aria-label="Settle payout"
          title="Settle payout"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

export function ClaimsPage() {
  const { address, isConnected, chainId } = useConnection();
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const claims = useClaims();
  const pool = usePoolSnapshot();
  const roles = useRoles(address);
  const roleFlags = roles.data ?? EMPTY_ROLES;
  const [newClaimOpen, setNewClaimOpen] = useState(false);
  const [action, setAction] = useState<{ claim: ClaimRecord; action: ClaimAction } | null>(null);

  const filtered = useMemo(
    () =>
      filterClaims(claims.data ?? [], {
        status: filters.status,
        category: filters.category,
        branch: filters.branch,
        search: filters.search,
        sort: filters.sort,
      }),
    [claims.data, filters.status, filters.category, filters.branch, filters.search, filters.sort],
  );

  const branchOptions = useMemo(() => {
    const codes = new Set<number>();
    for (const claim of claims.data ?? []) codes.add(claim.branchCode);
    for (const branch of BRANCH_OPTIONS) codes.add(branch.value);
    return [...codes].sort((a, b) => a - b);
  }, [claims.data]);

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.category !== 'all' ||
    filters.branch !== 'all' ||
    filters.search.trim() !== '' ||
    filters.sort !== 'newest';

  const update = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const clearFilters = () => setParams(new URLSearchParams(), { replace: true });

  const canCreate =
    isConnected && chainId === CHAIN_ID && Boolean(roles.data?.isOperator) && !claims.error;

  const createDisabledReason = !isConnected
    ? 'Connect a wallet that holds the Claim Operator role.'
    : chainId !== CHAIN_ID
      ? 'Switch to the configured network before submitting a claim.'
      : !roles.data
        ? 'Checking wallet roles…'
        : !roles.data.isOperator
          ? 'Your wallet does not hold the Claim Operator role.'
          : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Claims"
        description="Review synthetic claims and track on-chain state. Metadata is opaque and must never contain personal data."
        actions={
          <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              onClick={() => setNewClaimOpen(true)}
              disabled={!canCreate}
              title={createDisabledReason}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New claim
            </Button>
            {!canCreate && createDisabledReason && isConnected ? (
              <span className="text-ink-muted max-w-[260px] text-right text-[11px] leading-4">
                {createDisabledReason}
              </span>
            ) : null}
          </div>
        }
      />

      {isConnected && roles.data && !roles.data.isOperator ? (
        <InlineNotice tone="info" title="Operator role required to submit">
          Your wallet can view claims and, with the relevant role, approve, reject, cancel, or
          settle them. Only wallets holding Claim Operator can create claims; the contract enforces
          this.
        </InlineNotice>
      ) : null}

      <Card>
        <CardHeader
          title="Claim queue"
          description={
            claims.data
              ? `${formatInteger(filtered.length)} of ${formatInteger(claims.data.length)} claims match the current filters.`
              : 'Loading claim records from the ClaimManager contract.'
          }
          action={
            hasActiveFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                Clear filters
              </Button>
            ) : null
          }
        />
        <div className="border-border mt-4 grid gap-3 border-t px-5 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-5">
          <label className="block">
            <span className="label">Status</span>
            <Select
              value={filters.status}
              onChange={(event) => update('status', event.target.value, 'all')}
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="label">Category</span>
            <Select
              value={filters.category}
              onChange={(event) => update('category', event.target.value, 'all')}
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category.value} value={String(category.value)}>
                  {category.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="label">Branch</span>
            <Select
              value={filters.branch}
              onChange={(event) => update('branch', event.target.value, 'all')}
              aria-label="Filter by branch"
            >
              <option value="all">All branches</option>
              {branchOptions.map((branch) => (
                <option key={branch} value={String(branch)}>
                  {branchLabel(branch)}
                </option>
              ))}
            </Select>
          </label>
          <label className="relative block">
            <span className="label">Search</span>
            <Search
              className="text-ink-muted pointer-events-none absolute bottom-[13px] left-3 h-4 w-4"
              aria-hidden="true"
            />
            <Input
              value={filters.search}
              onChange={(event) => update('q', event.target.value, '')}
              placeholder="Claim ID or reference hash"
              aria-label="Search by claim ID or reference hash"
              className="pl-9"
            />
          </label>
          <label className="block">
            <span className="label">Sort</span>
            <Select
              value={filters.sort}
              onChange={(event) => update('sort', event.target.value, 'newest')}
              aria-label="Sort claims"
            >
              <option value="newest">Newest first</option>
              <option value="amount">Amount, high to low</option>
            </Select>
          </label>
        </div>

        {claims.error ? (
          <div className="px-5 pb-5 sm:px-6">
            <ErrorState
              title="Claims could not be loaded"
              message={readErrorMessage(claims.error).message}
              onRetry={() => void claims.refetch()}
            />
          </div>
        ) : claims.isPending ? (
          <div className="border-border border-t">
            <ClaimsSkeleton />
          </div>
        ) : (claims.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No claims yet"
            description="Create a synthetic claim with opaque references to start the demonstration. Never include personal data."
            action={
              canCreate ? (
                <Button type="button" size="sm" onClick={() => setNewClaimOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New claim
                </Button>
              ) : (
                <span className="text-ink-muted text-xs">
                  Connect a wallet holding the Claim Operator role to create the first claim.
                </span>
              )
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No claims match these filters"
            description="Adjust the status, category, branch, search, or sort controls. Filters do not change on-chain state."
            action={
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <div className="border-border hidden border-t md:block">
              <TableContainer>
                <THead>
                  <TR>
                    <TH>Claim</TH>
                    <TH>Branch</TH>
                    <TH>Category</TH>
                    <TH>Recipient</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Status</TH>
                    <TH>Updated</TH>
                    <TH>Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((claim) => {
                    const actions = availableClaimActions(
                      claim,
                      roleFlags,
                      address,
                      pool.data?.allowSelfApproval ?? false,
                    );
                    return (
                      <TR key={claim.claimId}>
                        <TD>
                          <Link to={`/claims/${claim.claimId}`} className="link mono">
                            {shortHash(claim.claimId, 6)}
                          </Link>
                          <p
                            className="mono text-ink-muted mt-0.5 text-[10px]"
                            title={claim.claimRefHash}
                          >
                            {shortHash(claim.claimRefHash, 5)}
                          </p>
                        </TD>
                        <TD>{branchLabel(claim.branchCode)}</TD>
                        <TD>{categoryLabel(claim.categoryId)}</TD>
                        <TD>
                          <AddressText address={claim.recipient} explorer={false} />
                        </TD>
                        <TD className="tabular text-ink-primary text-right font-semibold">
                          {formatToken(claim.amount)}
                        </TD>
                        <TD>
                          <StatusBadge status={claim.status} compact />
                        </TD>
                        <TD>
                          <time
                            dateTime={new Date(claim.updatedAt * 1000).toISOString()}
                            title={formatDateTime(claim.updatedAt)}
                          >
                            {formatRelativeTime(claim.updatedAt)}
                          </time>
                        </TD>
                        <TD>
                          <RowActions
                            claim={claim}
                            actions={actions}
                            onAction={(target, nextAction) =>
                              setAction({ claim: target, action: nextAction })
                            }
                          />
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </TableContainer>
            </div>

            <div className="border-border space-y-3 border-t p-4 md:hidden">
              {filtered.map((claim) => {
                const actions = availableClaimActions(
                  claim,
                  roleFlags,
                  address,
                  pool.data?.allowSelfApproval ?? false,
                );
                return (
                  <div
                    key={claim.claimId}
                    className="rounded-card border-border bg-surface border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/claims/${claim.claimId}`} className="link mono">
                        {shortHash(claim.claimId, 6)}
                      </Link>
                      <StatusBadge status={claim.status} compact />
                    </div>
                    <p className="tabular text-ink-primary mt-2 text-xl font-semibold">
                      {formatToken(claim.amount)}{' '}
                      <span className="text-ink-muted text-xs font-medium">mUSDC</span>
                    </p>
                    <div className="text-ink-secondary mt-2 flex items-center justify-between gap-3 text-xs">
                      <span>
                        {branchLabel(claim.branchCode)} · {categoryLabel(claim.categoryId)}
                      </span>
                      <AddressText address={claim.recipient} explorer={false} />
                    </div>
                    <p className="text-ink-muted mt-1 text-xs">
                      Updated {formatRelativeTime(claim.updatedAt)}
                    </p>
                    <div className="border-border mt-3 border-t pt-2">
                      <RowActions
                        claim={claim}
                        actions={actions}
                        onAction={(target, nextAction) =>
                          setAction({ claim: target, action: nextAction })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {canCreate ? (
        <NewClaimDialog open={newClaimOpen} onClose={() => setNewClaimOpen(false)} />
      ) : null}

      {action ? (
        <ClaimActionDialog
          claim={action.claim}
          action={action.action}
          open
          onClose={() => setAction(null)}
        />
      ) : null}
    </div>
  );
}
