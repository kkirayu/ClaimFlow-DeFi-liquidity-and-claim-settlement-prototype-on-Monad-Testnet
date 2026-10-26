import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { TableContainer, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { AddressText, TxLink } from '@/components/data-display/AddressText';
import { buttonStyles } from '@/components/ui/Button';
import { EVENT_LABELS, EVENT_TONES, type ProtocolEvent } from '@/lib/events';
import { formatRelativeTime, formatToken } from '@/lib/format';
import { shortHash } from '@/lib/format';
import { cn } from '@/lib/cn';

const dotTone = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-primary',
  neutral: 'bg-ink-muted',
};

export function RecentActivityCard({
  events,
  isLoading,
  error,
  onRetry,
}: {
  events: ProtocolEvent[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const recent = events.slice(0, 8);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Recent activity"
        description="Decoded ClaimManager and vault events, newest first."
        action={
          <Link to="/protocol" className="text-primary text-xs font-semibold hover:underline">
            Audit details
          </Link>
        }
      />

      {error ? (
        <div className="px-5 pb-5 sm:px-6">
          <ErrorState
            title="Activity could not be loaded"
            message="Event logs were not returned by the RPC provider. Pool metrics above remain independently read."
            onRetry={onRetry}
          />
        </div>
      ) : isLoading ? (
        <div className="border-border mt-5 border-t p-5">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-4 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
      ) : recent.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Deposit mock USDC or create a synthetic claim to start the demo."
          icon={<Activity className="h-5 w-5" aria-hidden="true" />}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/liquidity" className={buttonStyles({ size: 'sm', variant: 'outline' })}>
                Add liquidity
              </Link>
              <Link to="/claims" className={buttonStyles({ size: 'sm' })}>
                Open claims
              </Link>
            </div>
          }
        />
      ) : (
        <div className="border-border mt-5 border-t">
          <TableContainer>
            <THead>
              <TR>
                <TH>Event</TH>
                <TH>Claim</TH>
                <TH className="text-right">Amount</TH>
                <TH>Actor</TH>
                <TH>When</TH>
                <TH>Transaction</TH>
              </TR>
            </THead>
            <TBody>
              {recent.map((event) => (
                <TR key={event.id}>
                  <TD>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={cn('h-2 w-2 rounded-full', dotTone[EVENT_TONES[event.kind]])}
                        aria-hidden="true"
                      />
                      <span className="text-ink-primary font-medium">
                        {EVENT_LABELS[event.kind]}
                      </span>
                    </span>
                  </TD>
                  <TD>
                    {event.claimId ? (
                      <Link to={`/claims/${event.claimId}`} className="link mono">
                        {shortHash(event.claimId)}
                      </Link>
                    ) : (
                      <span className="text-ink-muted">Batch</span>
                    )}
                  </TD>
                  <TD className="tabular text-ink-primary text-right font-medium">
                    {event.amount !== undefined ? `${formatToken(event.amount)} mUSDC` : '—'}
                  </TD>
                  <TD>
                    <AddressText address={event.actor} explorer={false} />
                  </TD>
                  <TD>
                    <time
                      dateTime={
                        event.timestamp ? new Date(event.timestamp * 1000).toISOString() : undefined
                      }
                      title={
                        event.timestamp
                          ? new Date(event.timestamp * 1000).toLocaleString()
                          : undefined
                      }
                    >
                      {formatRelativeTime(event.timestamp)}
                    </time>
                  </TD>
                  <TD>
                    <TxLink hash={event.txHash} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </TableContainer>
        </div>
      )}
    </Card>
  );
}
