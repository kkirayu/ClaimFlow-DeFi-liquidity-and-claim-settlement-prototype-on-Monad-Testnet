import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { explorerBlockUrl } from '@/lib/chain';
import { formatDateTime, formatInteger, formatToken } from '@/lib/format';
import { EVENT_LABELS, EVENT_TONES, claimEventDescription, type ProtocolEvent } from '@/lib/events';
import { shortHash } from '@/lib/format';
import { cn } from '@/lib/cn';
import { TxLink } from './AddressText';
import { EmptyState } from '@/components/ui/Feedback';

const dotTone = {
  success: 'border-success-border bg-success',
  warning: 'border-warning-border bg-warning',
  danger: 'border-danger-border bg-danger',
  info: 'border-[#C7D7FE] bg-primary',
  neutral: 'border-border-strong bg-ink-muted',
};

export function EventIcon({ event }: { event: ProtocolEvent }) {
  return (
    <span
      className={cn(
        'border-surface mt-1 flex h-3 w-3 shrink-0 rounded-full border-2 ring-1',
        dotTone[EVENT_TONES[event.kind]],
      )}
      aria-hidden="true"
    />
  );
}

export function Timeline({
  events,
  emptyTitle = 'No events yet',
  emptyDescription = 'On-chain events will appear here after the first action.',
  showClaimLink = true,
  footer,
}: {
  events: ProtocolEvent[];
  emptyTitle?: string;
  emptyDescription?: string;
  showClaimLink?: boolean;
  footer?: ReactNode;
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={<span className="text-lg">·</span>}
      />
    );
  }

  return (
    <div>
      <ol className="relative ml-1.5">
        {events.map((event, index) => {
          const blockUrl = explorerBlockUrl(event.blockNumber);
          return (
            <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
              {index !== events.length - 1 ? (
                <span
                  className="bg-border absolute left-[5px] top-5 h-[calc(100%-8px)] w-px"
                  aria-hidden="true"
                />
              ) : null}
              <EventIcon event={event} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-ink-primary text-sm font-semibold">
                      {EVENT_LABELS[event.kind]}
                    </p>
                    <p className="text-ink-secondary mt-0.5 text-[13px] leading-5">
                      {claimEventDescription(event)}
                    </p>
                  </div>
                  <time
                    className="text-ink-muted shrink-0 text-xs"
                    dateTime={
                      event.timestamp ? new Date(event.timestamp * 1000).toISOString() : undefined
                    }
                    title={formatDateTime(event.timestamp)}
                  >
                    {formatDateTime(event.timestamp)}
                  </time>
                </div>
                <div className="text-ink-muted mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                  {event.amount !== undefined ? (
                    <span className="tabular text-ink-secondary font-medium">
                      {formatToken(event.amount)} mUSDC
                    </span>
                  ) : null}
                  {event.claimsCount !== undefined ? (
                    <span>{formatInteger(event.claimsCount)} claims</span>
                  ) : null}
                  {showClaimLink && event.claimId ? (
                    <Link to={`/claims/${event.claimId}`} className="link">
                      {shortHash(event.claimId)}
                    </Link>
                  ) : null}
                  <span>Tx {<TxLink hash={event.txHash} />}</span>
                  {blockUrl ? (
                    <a
                      href={blockUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary hover:underline"
                    >
                      Block {event.blockNumber.toString()}
                    </a>
                  ) : (
                    <span>Block {event.blockNumber.toString()}</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {footer}
    </div>
  );
}
