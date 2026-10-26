import type { AbiEvent, Address, Hex, PublicClient } from 'viem';
import { claimManagerAbi, contracts, liquidityVaultAbi } from './contracts';
import { deploymentBlock } from './chain';

export type ProtocolEventKind =
  | 'ClaimSubmitted'
  | 'ClaimApproved'
  | 'ClaimRejected'
  | 'ClaimCancelled'
  | 'ClaimPaid'
  | 'BatchSettled'
  | 'Deposited'
  | 'Withdrawn'
  | 'LiquidityReserved'
  | 'LiquidityReleased'
  | 'PayoutExecuted';

export type EventTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export interface ProtocolEvent {
  id: string;
  kind: ProtocolEventKind;
  layer: 'claim' | 'vault';
  claimId?: Hex;
  referenceHash?: Hex;
  actor?: Address;
  recipient?: Address;
  amount?: bigint;
  batchId?: Hex;
  claimsCount?: number;
  txHash: Hex;
  blockNumber: bigint;
  logIndex: number;
  timestamp: number;
}

export const EVENT_LABELS: Record<ProtocolEventKind, string> = {
  ClaimSubmitted: 'Claim submitted',
  ClaimApproved: 'Claim approved & reserved',
  ClaimRejected: 'Claim rejected',
  ClaimCancelled: 'Claim cancelled',
  ClaimPaid: 'Claim paid',
  BatchSettled: 'Batch settled',
  Deposited: 'Liquidity deposited',
  Withdrawn: 'Liquidity withdrawn',
  LiquidityReserved: 'Liquidity reserved',
  LiquidityReleased: 'Liquidity released',
  PayoutExecuted: 'Vault payout executed',
};

export const EVENT_TONES: Record<ProtocolEventKind, EventTone> = {
  ClaimSubmitted: 'info',
  ClaimApproved: 'info',
  ClaimRejected: 'danger',
  ClaimCancelled: 'neutral',
  ClaimPaid: 'success',
  BatchSettled: 'success',
  Deposited: 'success',
  Withdrawn: 'warning',
  LiquidityReserved: 'warning',
  LiquidityReleased: 'info',
  PayoutExecuted: 'success',
};

interface RawLog {
  eventName?: string;
  args?: Record<string, unknown>;
  transactionHash?: Hex;
  blockNumber?: bigint | null;
  logIndex?: number | null;
}

const timestampCache = new Map<string, number>();

async function requestBlockTimestamps(
  client: PublicClient,
  logs: RawLog[],
): Promise<Map<bigint, number>> {
  const unique = [...new Set(logs.map((log) => log.blockNumber).filter(Boolean))] as bigint[];
  const result = new Map<bigint, number>();
  const cacheKey = (block: bigint) => `${client.chain?.id ?? 'unknown'}:${block.toString()}`;

  for (const block of unique) {
    const cached = timestampCache.get(cacheKey(block));
    if (cached !== undefined) result.set(block, cached);
  }

  const missing = unique.filter((block) => !result.has(block));
  const concurrency = 4;
  for (let index = 0; index < missing.length; index += concurrency) {
    const batch = missing.slice(index, index + concurrency);
    const blocks = await Promise.allSettled(
      batch.map((block) => client.getBlock({ blockNumber: block })),
    );
    blocks.forEach((settled, offset) => {
      const blockNumber = batch[offset];
      if (blockNumber === undefined) return;
      if (settled.status === 'fulfilled') {
        const timestamp = Number(settled.value.timestamp);
        result.set(blockNumber, timestamp);
        timestampCache.set(cacheKey(blockNumber), timestamp);
      }
    });
  }

  return result;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(value);
  return undefined;
}

function mapLog(log: RawLog, timestamps: Map<bigint, number>): ProtocolEvent | null {
  const kind = log.eventName as ProtocolEventKind | undefined;
  if (!kind || !(kind in EVENT_LABELS)) return null;
  if (!log.transactionHash || log.blockNumber === undefined || log.blockNumber === null)
    return null;

  const args = log.args ?? {};
  const layer = [
    'Deposited',
    'Withdrawn',
    'LiquidityReserved',
    'LiquidityReleased',
    'PayoutExecuted',
  ].includes(kind)
    ? 'vault'
    : 'claim';

  let amount = asBigInt(args.amount);
  if (kind === 'BatchSettled') amount = asBigInt(args.totalAmount);
  if (kind === 'Deposited' || kind === 'Withdrawn') amount = asBigInt(args.assets);

  const actor =
    (kind === 'Deposited' || kind === 'Withdrawn' ? asString(args.provider) : undefined) ??
    (args.actor ? asString(args.actor) : undefined);

  return {
    id: `${log.transactionHash}-${log.logIndex ?? 0}`,
    kind,
    layer,
    claimId: asString(args.claimId) as Hex | undefined,
    referenceHash: asString(args.claimRefHash) as Hex | undefined,
    actor: actor as Address | undefined,
    recipient: asString(args.recipient) as Address | undefined,
    amount,
    batchId: asString(args.batchId) as Hex | undefined,
    claimsCount:
      kind === 'BatchSettled' && args.claimsCount !== undefined
        ? Number(args.claimsCount)
        : undefined,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    logIndex: log.logIndex ?? 0,
    timestamp: timestamps.get(log.blockNumber) ?? 0,
  };
}

export async function fetchProtocolEvents(client: PublicClient): Promise<ProtocolEvent[]> {
  if (!contracts.manager || !contracts.vault) {
    throw new Error('ClaimFlow contracts are not configured.');
  }

  const claimEvents = claimManagerAbi.filter((item) => item.type === 'event') as AbiEvent[];
  const vaultEvents = liquidityVaultAbi.filter((item) => item.type === 'event') as AbiEvent[];

  const [claimLogs, vaultLogs] = await Promise.all([
    client.getLogs({
      address: contracts.manager.address,
      events: claimEvents,
      fromBlock: deploymentBlock,
      toBlock: 'latest',
    }),
    client.getLogs({
      address: contracts.vault.address,
      events: vaultEvents,
      fromBlock: deploymentBlock,
      toBlock: 'latest',
    }),
  ]);

  // viem decodes events when an ABI is supplied; normalize to a narrow local shape.
  const rawLogs = [...claimLogs, ...vaultLogs] as unknown as RawLog[];
  const timestamps = await requestBlockTimestamps(client, rawLogs);

  return rawLogs
    .map((log) => mapLog(log, timestamps))
    .filter((event): event is ProtocolEvent => event !== null)
    .sort((a, b) => {
      if (a.blockNumber === b.blockNumber) return b.logIndex - a.logIndex;
      return a.blockNumber < b.blockNumber ? 1 : -1;
    });
}

export function claimEventDescription(event: ProtocolEvent): string {
  switch (event.kind) {
    case 'ClaimSubmitted':
      return 'Claim metadata recorded on-chain and moved to Pending.';
    case 'ClaimApproved':
      return 'Approver decision recorded; liquidity was reserved atomically.';
    case 'ClaimRejected':
      return 'Approver rejected the claim. No liquidity was reserved.';
    case 'ClaimCancelled':
      return 'Claim cancelled. Any reservation was released; tokens did not move.';
    case 'ClaimPaid':
      return 'Vault transferred the reserved amount to the recipient.';
    case 'BatchSettled':
      return `${event.claimsCount ?? 0} claims paid in one all-or-nothing transaction.`;
    case 'LiquidityReserved':
      return 'Vault locked available liquidity for this claim.';
    case 'LiquidityReleased':
      return 'Vault released the reservation back to available liquidity.';
    case 'PayoutExecuted':
      return 'Vault payout executed after clearing the reservation.';
    case 'Deposited':
      return 'LP deposited tokens and received pool shares.';
    case 'Withdrawn':
      return 'LP redeemed shares against available liquidity.';
    default:
      return 'On-chain event.';
  }
}
