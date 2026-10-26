import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Hex, TransactionReceipt } from 'viem';
import { useConnection } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Layers, Search, Send, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { EmptyState, ErrorState, InlineNotice, Skeleton } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Input';
import { TableContainer, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { AddressText, TxLink } from '@/components/data-display/AddressText';
import { BatchPreview } from '@/components/transactions/BatchPreview';
import { useTransaction } from '@/components/transactions/TransactionProvider';
import { ConnectInlineButton } from '@/components/wallet/ConnectInlineButton';
import { useClaims, usePoolSnapshot, useRoles } from '@/hooks/useProtocol';
import { approvedClaims } from '@/lib/claims';
import { CHAIN_ID, publicClient } from '@/lib/chain';
import { requireProtocol } from '@/lib/contracts';
import {
  formatDateTime,
  formatGas,
  formatInteger,
  formatLatency,
  formatRelativeTime,
  formatToken,
  shortHash,
} from '@/lib/format';
import { readErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

interface BatchResult {
  count: number;
  total: bigint;
  durationMs: number;
  receipt: TransactionReceipt;
}

function sumAmounts(claims: { amount: bigint }[]): bigint {
  return claims.reduce((total, claim) => total + claim.amount, 0n);
}

export function SettlementPage() {
  const { address, isConnected, chainId } = useConnection();
  const claims = useClaims();
  const pool = usePoolSnapshot();
  const roles = useRoles(address);
  const { run, isBusy } = useTransaction();
  const { manager } = requireProtocol();

  const [selected, setSelected] = useState<Set<Hex>>(() => new Set());
  const [search, setSearch] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);

  const cap = pool.data?.maxBatchSize ?? 0n;
  const capNumber = Number(cap);
  const canSettle =
    isConnected &&
    chainId === CHAIN_ID &&
    Boolean(roles.data?.isSettler) &&
    Boolean(pool.data) &&
    !claims.error;

  const approved = useMemo(() => approvedClaims(claims.data ?? []), [claims.data]);
  const eligibleIds = useMemo(
    () => new Set<Hex>(approved.map((claim) => claim.claimId)),
    [approved],
  );

  useEffect(() => {
    setSelected((current) => {
      const next = new Set<Hex>();
      let changed = false;
      for (const id of current) {
        if (eligibleIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : current;
    });
  }, [eligibleIds]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return approved;
    return approved.filter((claim) =>
      `${claim.claimId} ${claim.claimRefHash} ${claim.recipient}`.toLowerCase().includes(query),
    );
  }, [approved, search]);

  const selectedClaims = approved.filter((claim) => selected.has(claim.claimId));
  const total = sumAmounts(selectedClaims);
  const totalApproved = sumAmounts(approved);
  const overCap = capNumber > 0 && selectedClaims.length > capNumber;

  const ids = selectedClaims.map((claim) => claim.claimId);
  const gasQuery = useQuery({
    queryKey: ['settlement', 'batch-gas', ids.join(','), address],
    enabled: previewOpen && canSettle && ids.length > 0 && !overCap,
    retry: false,
    staleTime: 15_000,
    queryFn: () =>
      publicClient.estimateContractGas({
        ...manager,
        functionName: 'settleBatch',
        args: [ids],
        account: address!,
      }),
  });

  const toggle = (claimId: Hex) => {
    setLimitNotice(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(claimId)) {
        next.delete(claimId);
      } else {
        if (capNumber > 0 && next.size >= capNumber) {
          setLimitNotice(
            `Batch cap reached. The contract allows at most ${capNumber} claims per batch.`,
          );
          return current;
        }
        next.add(claimId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setLimitNotice(null);
    if (capNumber === 0) return;
    const visible = filtered.slice(0, capNumber);
    setSelected(new Set(visible.map((claim) => claim.claimId)));
    if (filtered.length > capNumber) {
      setLimitNotice(
        `Selected the first ${capNumber} matching claims. The batch cap is ${capNumber}.`,
      );
    }
  };

  const openPreview = () => {
    const stale = selected.size - selectedClaims.length;
    if (stale > 0) {
      setLimitNotice(
        'Some selected claims are no longer approved and reserved. The selection was refreshed before signing.',
      );
      setSelected(new Set(selectedClaims.map((claim) => claim.claimId)));
      return;
    }
    if (selectedClaims.length === 0) {
      setLimitNotice('Select at least one approved claim.');
      return;
    }
    if (overCap) {
      setLimitNotice(`Remove ${selectedClaims.length - capNumber} claim(s) to fit the batch cap.`);
      return;
    }
    setPreviewOpen(true);
  };

  const handleConfirm = async () => {
    const started = performance.now();
    const batchTotal = sumAmounts(selectedClaims);
    const count = selectedClaims.length;
    const response = await run({
      label: `Settle batch of ${count} claims`,
      request: {
        address: manager.address,
        abi: manager.abi,
        functionName: 'settleBatch',
        args: [ids],
      },
    });
    if (response) {
      setResult({
        count,
        total: batchTotal,
        durationMs: performance.now() - started,
        receipt: response.receipt,
      });
      setSelected(new Set());
      setPreviewOpen(false);
      setLimitNotice(null);
    }
  };

  const reviewDisabledReason = !isConnected
    ? 'Connect a settlement wallet.'
    : chainId !== CHAIN_ID
      ? 'Switch to the configured network.'
      : !roles.data
        ? 'Checking wallet roles…'
        : !roles.data.isSettler
          ? 'Your wallet needs the Settlement Operator role.'
          : !pool.data
            ? 'Loading batch cap…'
            : selectedClaims.length === 0
              ? 'Select at least one claim.'
              : overCap
                ? 'Selection exceeds the batch cap.'
                : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settlement"
        description="Batch approved claims into one all-or-nothing payout. Verify every recipient before signing."
        actions={
          <Link to="/claims" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
            Review claims
          </Link>
        }
      />

      <section aria-label="Settlement summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card card-pad">
          <p className="text-ink-secondary text-[13px] font-medium">Approved & reserved</p>
          <p className="tabular text-ink-primary mt-2 text-[26px] font-semibold">
            {claims.isPending ? <Skeleton className="h-7 w-12" /> : formatInteger(approved.length)}
          </p>
          <p className="text-ink-muted mt-2 text-xs">Eligible for settlement</p>
        </div>
        <div className="card card-pad">
          <p className="text-ink-secondary text-[13px] font-medium">Approved value</p>
          <p className="tabular text-primary mt-2 text-[26px] font-semibold">
            {claims.isPending ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              `${formatToken(totalApproved)} mUSDC`
            )}
          </p>
          <p className="text-ink-muted mt-2 text-xs">Reserved for these claims</p>
        </div>
        <div className="card card-pad">
          <p className="text-ink-secondary text-[13px] font-medium">Batch cap</p>
          <p className="tabular text-ink-primary mt-2 text-[26px] font-semibold">
            {pool.isPending ? <Skeleton className="h-7 w-10" /> : capNumber}
          </p>
          <p className="text-ink-muted mt-2 text-xs">Maximum claims per transaction</p>
        </div>
        <div className="card card-pad">
          <p className="text-ink-secondary text-[13px] font-medium">Selected</p>
          <p className="tabular text-ink-primary mt-2 text-[26px] font-semibold">
            {selectedClaims.length}
          </p>
          <p className="tabular text-ink-muted mt-2 text-xs font-medium">
            {formatToken(total)} mUSDC total
          </p>
        </div>
      </section>

      {!isConnected ? (
        <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-secondary text-[13px] leading-5">
            Connect a wallet holding the Settlement Operator role to select and pay claims.
          </p>
          <ConnectInlineButton label="Connect wallet" />
        </div>
      ) : chainId !== CHAIN_ID ? (
        <InlineNotice tone="danger" title="Wrong network">
          Switch your wallet to chain {CHAIN_ID} before settling claims. Read-only queue data is
          still available.
        </InlineNotice>
      ) : roles.data && !roles.data.isSettler ? (
        <InlineNotice tone="warning" title="Settlement role required">
          Your wallet can inspect this queue but does not hold Settlement Operator. The contract
          rejects settlement calls from other accounts.
        </InlineNotice>
      ) : null}

      {result ? (
        <Card className="border-success-border">
          <CardHeader
            title="Batch confirmed"
            description="The payout receipt is on-chain. Claim and liquidity state have been refreshed."
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setResult(null)}
                aria-label="Dismiss batch result"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            }
          />
          <div className="border-border grid gap-4 border-t px-5 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-5">
            <div>
              <p className="text-ink-muted text-[11px] font-medium">Claims paid</p>
              <p className="tabular text-ink-primary mt-0.5 text-lg font-semibold">
                {formatInteger(result.count)}
              </p>
            </div>
            <div>
              <p className="text-ink-muted text-[11px] font-medium">Total paid</p>
              <p className="tabular text-success mt-0.5 text-lg font-semibold">
                {formatToken(result.total)} mUSDC
              </p>
            </div>
            <div>
              <p className="text-ink-muted text-[11px] font-medium">Receipt latency</p>
              <p className="tabular text-ink-primary mt-0.5 text-lg font-semibold">
                {formatLatency(result.durationMs)}
              </p>
            </div>
            <div>
              <p className="text-ink-muted text-[11px] font-medium">Gas used</p>
              <p className="tabular text-ink-primary mt-0.5 text-lg font-semibold">
                {formatGas(result.receipt.gasUsed)}
              </p>
            </div>
            <div>
              <p className="text-ink-muted text-[11px] font-medium">Transaction</p>
              <p className="mt-1 text-[13px]">
                <TxLink hash={result.receipt.transactionHash} label="View batch" />
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Approved queue"
          description="Only claims in Approved & Reserved can be paid. Selection is cleared automatically if state changes."
          action={
            <Button
              type="button"
              size="sm"
              variant="success"
              onClick={openPreview}
              disabled={Boolean(reviewDisabledReason) || isBusy}
              title={reviewDisabledReason}
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              Review batch
            </Button>
          }
        />

        <div className="border-border mt-4 flex flex-col gap-3 border-t px-5 py-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <label className="relative block w-full max-w-md">
            <span className="label">Search approved claims</span>
            <Search
              className="text-ink-muted pointer-events-none absolute bottom-[13px] left-3 h-4 w-4"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Claim ID, reference hash, or recipient"
              className="pl-9"
              aria-label="Search approved claims"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-muted text-xs">
              {selectedClaims.length} selected · {formatToken(total)} mUSDC
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={!canSettle || filtered.length === 0}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelected(new Set());
                setLimitNotice(null);
              }}
              disabled={selected.size === 0}
            >
              Clear
            </Button>
          </div>
        </div>

        {reviewDisabledReason && canSettle ? (
          <p className="text-ink-muted px-5 pb-3 text-xs sm:px-6">{reviewDisabledReason}</p>
        ) : null}

        {limitNotice ? (
          <div className="px-5 pb-3 sm:px-6">
            <InlineNotice tone="warning">{limitNotice}</InlineNotice>
          </div>
        ) : null}

        {claims.error ? (
          <div className="px-5 pb-5 sm:px-6">
            <ErrorState
              title="Settlement queue unavailable"
              message={readErrorMessage(claims.error).message}
              onRetry={() => void claims.refetch()}
            />
          </div>
        ) : claims.isPending ? (
          <div className="border-border space-y-3 border-t px-5 py-5 sm:px-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="ml-auto h-4 w-20" />
              </div>
            ))}
          </div>
        ) : approved.length === 0 ? (
          <EmptyState
            title="No approved claims waiting"
            description="Approve a pending claim first. Approval atomically reserves liquidity and makes the claim eligible for settlement."
            action={
              <Link
                to="/claims?status=1"
                className={buttonStyles({ variant: 'outline', size: 'sm' })}
              >
                Review pending claims
              </Link>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No approved claims match this search"
            description="Clear the search box to see the full approved queue."
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => setSearch('')}>
                Clear search
              </Button>
            }
          />
        ) : (
          <>
            <div className="border-border hidden border-t md:block">
              <TableContainer>
                <THead>
                  <TR>
                    <TH className="w-10">
                      <span className="sr-only">Select</span>
                    </TH>
                    <TH>Claim</TH>
                    <TH>Recipient</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Updated</TH>
                    <TH>Detail</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((claim) => {
                    const checked = selected.has(claim.claimId);
                    const capReached = capNumber > 0 && selected.size >= capNumber && !checked;
                    return (
                      <TR key={claim.claimId} className={cn(checked && 'bg-primary-soft/40')}>
                        <TD>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canSettle || capReached}
                            onChange={() => toggle(claim.claimId)}
                            aria-label={`Select claim ${shortHash(claim.claimId)}`}
                            title={capReached ? `Batch cap of ${capNumber} reached` : undefined}
                            className="h-4 w-4 accent-[#465FFF]"
                          />
                        </TD>
                        <TD>
                          <span className="mono">{shortHash(claim.claimId, 6)}</span>
                          <p className="mono text-ink-muted mt-0.5 text-[10px]">
                            {shortHash(claim.claimRefHash, 5)}
                          </p>
                        </TD>
                        <TD>
                          <AddressText address={claim.recipient} explorer={false} />
                        </TD>
                        <TD className="tabular text-ink-primary text-right font-semibold">
                          {formatToken(claim.amount)}
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
                          <Link to={`/claims/${claim.claimId}`} className="link text-xs">
                            View
                          </Link>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </TableContainer>
            </div>

            <div className="border-border space-y-3 border-t p-4 md:hidden">
              {filtered.map((claim) => {
                const checked = selected.has(claim.claimId);
                const capReached = capNumber > 0 && selected.size >= capNumber && !checked;
                return (
                  <label
                    key={claim.claimId}
                    className={cn(
                      'rounded-card border-border bg-surface block border p-4',
                      checked && 'border-primary/40 bg-primary-soft/30',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canSettle || capReached}
                        onChange={() => toggle(claim.claimId)}
                        aria-label={`Select claim ${shortHash(claim.claimId)}`}
                        className="mt-1 h-4 w-4 accent-[#465FFF]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <span className="mono">{shortHash(claim.claimId, 6)}</span>
                          <span className="tabular text-ink-primary text-base font-semibold">
                            {formatToken(claim.amount)}
                          </span>
                        </div>
                        <div className="text-ink-secondary mt-1 flex items-center justify-between gap-3 text-xs">
                          <AddressText address={claim.recipient} explorer={false} />
                          <span className="text-ink-muted">
                            {formatRelativeTime(claim.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <div className="rounded-card border-info-border bg-info-bg text-ink-secondary flex items-start gap-2 border px-4 py-3 text-[11px] leading-4">
        <Layers className="text-info mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Batch settlement is atomic. If one claim is invalid, the whole transaction reverts and no
        claim is paid. Sent transactions cannot be cancelled from the interface.
      </div>

      <BatchPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        claims={selectedClaims}
        cap={cap}
        total={total}
        gasEstimate={gasQuery.data}
        gasLoading={gasQuery.isPending}
        gasUnavailable={gasQuery.isError}
        onConfirm={handleConfirm}
        isBusy={isBusy}
      />

      {!previewOpen && result ? (
        <div className="text-success flex items-center gap-2 text-xs">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Last batch paid {formatInteger(result.count)} claims ({formatToken(result.total)} mUSDC).
        </div>
      ) : null}
    </div>
  );
}
