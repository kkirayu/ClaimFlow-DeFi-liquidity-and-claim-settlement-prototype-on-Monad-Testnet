import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Address, Hex } from 'viem';
import { publicClient, isConfigured } from '@/lib/chain';
import { requireProtocol } from '@/lib/contracts';
import { ClaimStatus, type ClaimRecord, type ClaimsStats } from '@/lib/claims';
import { ROLES, type RolesState } from '@/lib/roles';
import { fetchProtocolEvents, type ProtocolEvent } from '@/lib/events';

export const protocolKeys = {
  pool: ['protocol', 'pool'] as const,
  claims: ['protocol', 'claims'] as const,
  stats: ['protocol', 'stats'] as const,
  claim: (claimId?: string) => ['protocol', 'claim', claimId] as const,
  roles: (address?: string) => ['protocol', 'roles', address] as const,
  position: (address?: string) => ['protocol', 'position', address] as const,
  token: ['protocol', 'token'] as const,
  events: ['protocol', 'events'] as const,
};

export interface PoolSnapshot {
  totalAssets: bigint;
  available: bigint;
  reserved: bigint;
  totalShares: bigint;
  utilizationBps: bigint;
  maxBatchSize: bigint;
  allowSelfApproval: boolean;
  claimCount: number;
}

export interface LpPosition {
  balance: bigint;
  allowance: bigint;
  shares: bigint;
  shareValue: bigint;
  faucetAvailableAt: number;
  faucetMinted: bigint;
}

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  faucetAmount: bigint;
  faucetCooldown: number;
  faucetCap: bigint;
}

export interface StatsSnapshot extends ClaimsStats {
  total: number;
}

interface RawClaim {
  claimId: Hex;
  claimRefHash: Hex;
  branchCode: number | bigint;
  categoryId: number | bigint;
  recipient: Address;
  amount: bigint;
  evidenceHash: Hex;
  status: number | bigint;
  createdAt: number | bigint;
  updatedAt: number | bigint;
  createdBy: Address;
}

function normalizeClaim(raw: RawClaim | readonly unknown[]): ClaimRecord {
  const field = <T>(key: keyof RawClaim, index: number): T =>
    (Array.isArray(raw) ? raw[index] : (raw as RawClaim)[key]) as T;

  return {
    claimId: field<Hex>('claimId', 0),
    claimRefHash: field<Hex>('claimRefHash', 1),
    branchCode: Number(field<number | bigint>('branchCode', 2)),
    categoryId: Number(field<number | bigint>('categoryId', 3)),
    recipient: field<Address>('recipient', 4),
    amount: field<bigint>('amount', 5),
    evidenceHash: field<Hex>('evidenceHash', 6),
    status: Number(field<number | bigint>('status', 7)) as ClaimStatus,
    createdAt: Number(field<number | bigint>('createdAt', 8)),
    updatedAt: Number(field<number | bigint>('updatedAt', 9)),
    createdBy: field<Address>('createdBy', 10),
  };
}

async function readClaim(claimId: Hex): Promise<ClaimRecord | null> {
  const { manager } = requireProtocol();
  const raw = (await publicClient.readContract({
    ...manager,
    functionName: 'claims',
    args: [claimId],
  })) as unknown as RawClaim | readonly unknown[];

  const claim = normalizeClaim(raw);
  if (claim.status === ClaimStatus.None) return null;
  return claim;
}

export function usePoolSnapshot() {
  return useQuery({
    queryKey: protocolKeys.pool,
    enabled: isConfigured,
    staleTime: 8_000,
    refetchInterval: 20_000,
    queryFn: async (): Promise<PoolSnapshot> => {
      const { vault, manager } = requireProtocol();
      const [
        totalAssets,
        available,
        reserved,
        totalShares,
        utilizationBps,
        maxBatchSize,
        allowSelfApproval,
        claimCount,
      ] = await Promise.all([
        publicClient.readContract({ ...vault, functionName: 'totalAssets' }),
        publicClient.readContract({ ...vault, functionName: 'availableLiquidity' }),
        publicClient.readContract({ ...vault, functionName: 'totalReserved' }),
        publicClient.readContract({ ...vault, functionName: 'totalShares' }),
        publicClient.readContract({ ...vault, functionName: 'utilizationBps' }),
        publicClient.readContract({ ...manager, functionName: 'maxBatchSize' }),
        publicClient.readContract({ ...manager, functionName: 'allowSelfApproval' }),
        publicClient.readContract({ ...manager, functionName: 'claimCount' }),
      ]);

      return {
        totalAssets,
        available,
        reserved,
        totalShares,
        utilizationBps,
        maxBatchSize,
        allowSelfApproval,
        claimCount: Number(claimCount),
      };
    },
  });
}

export function useClaims() {
  return useQuery({
    queryKey: protocolKeys.claims,
    enabled: isConfigured,
    staleTime: 8_000,
    refetchInterval: 25_000,
    queryFn: async (): Promise<ClaimRecord[]> => {
      const { manager } = requireProtocol();
      const count = await publicClient.readContract({ ...manager, functionName: 'claimCount' });
      if (count === 0n) return [];
      const ids = await publicClient.readContract({
        ...manager,
        functionName: 'getClaimIds',
        args: [0n, count],
      });
      const records = await Promise.all(ids.map((id) => readClaim(id)));
      return records
        .filter((record): record is ClaimRecord => record !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
  });
}

export function useClaim(claimId?: Hex) {
  return useQuery({
    queryKey: protocolKeys.claim(claimId),
    enabled: isConfigured && Boolean(claimId),
    staleTime: 8_000,
    refetchInterval: 25_000,
    queryFn: async (): Promise<ClaimRecord | null> => {
      if (!claimId) return null;
      return readClaim(claimId);
    },
  });
}

export function useClaimStats() {
  return useQuery({
    queryKey: protocolKeys.stats,
    enabled: isConfigured,
    staleTime: 8_000,
    refetchInterval: 20_000,
    queryFn: async (): Promise<StatsSnapshot> => {
      const { manager } = requireProtocol();
      const raw = await publicClient.readContract({ ...manager, functionName: 'getStats' });
      return {
        total: Number(raw.total),
        pending: Number(raw.pending),
        approvedReserved: Number(raw.approvedReserved),
        paid: Number(raw.paid),
        rejected: Number(raw.rejected),
        cancelled: Number(raw.cancelled),
      };
    },
  });
}

export function useRoles(address?: Address) {
  return useQuery({
    queryKey: protocolKeys.roles(address),
    enabled: isConfigured && Boolean(address),
    staleTime: 15_000,
    queryFn: async (): Promise<RolesState> => {
      if (!address) {
        return {
          isOperator: false,
          isApprover: false,
          isSettler: false,
          isCanceller: false,
          isAdmin: false,
          isConnected: false,
        };
      }

      const { manager } = requireProtocol();
      const [operator, approver, settler, canceller, admin] = await Promise.all([
        publicClient.readContract({
          ...manager,
          functionName: 'hasRole',
          args: [ROLES.operator, address],
        }),
        publicClient.readContract({
          ...manager,
          functionName: 'hasRole',
          args: [ROLES.approver, address],
        }),
        publicClient.readContract({
          ...manager,
          functionName: 'hasRole',
          args: [ROLES.settler, address],
        }),
        publicClient.readContract({
          ...manager,
          functionName: 'hasRole',
          args: [ROLES.canceller, address],
        }),
        publicClient.readContract({
          ...manager,
          functionName: 'hasRole',
          args: [ROLES.admin, address],
        }),
      ]);

      return {
        isOperator: operator,
        isApprover: approver,
        isSettler: settler,
        isCanceller: canceller,
        isAdmin: admin,
        isConnected: true,
      };
    },
  });
}

export function useLpPosition(address?: Address) {
  return useQuery({
    queryKey: protocolKeys.position(address),
    enabled: isConfigured && Boolean(address),
    staleTime: 8_000,
    refetchInterval: 20_000,
    queryFn: async (): Promise<LpPosition> => {
      if (!address) throw new Error('A wallet address is required.');
      const { token, vault } = requireProtocol();

      const [balance, allowance, shares, faucetAvailableAt, faucetMinted] = await Promise.all([
        publicClient.readContract({ ...token, functionName: 'balanceOf', args: [address] }),
        publicClient.readContract({
          ...token,
          functionName: 'allowance',
          args: [address, vault.address],
        }),
        publicClient.readContract({ ...vault, functionName: 'sharesOf', args: [address] }),
        publicClient.readContract({
          ...token,
          functionName: 'faucetAvailableAt',
          args: [address],
        }),
        publicClient.readContract({ ...token, functionName: 'faucetMinted', args: [address] }),
      ]);

      const shareValue =
        shares === 0n
          ? 0n
          : await publicClient.readContract({
              ...vault,
              functionName: 'convertToAssets',
              args: [shares],
            });

      return {
        balance,
        allowance,
        shares,
        shareValue,
        faucetAvailableAt: Number(faucetAvailableAt),
        faucetMinted,
      };
    },
  });
}

export function useTokenInfo() {
  return useQuery({
    queryKey: protocolKeys.token,
    enabled: isConfigured,
    staleTime: Infinity,
    queryFn: async (): Promise<TokenInfo> => {
      const { token } = requireProtocol();
      const [name, symbol, decimals, faucetAmount, faucetCooldown, faucetCap] = await Promise.all([
        publicClient.readContract({ ...token, functionName: 'name' }),
        publicClient.readContract({ ...token, functionName: 'symbol' }),
        publicClient.readContract({ ...token, functionName: 'decimals' }),
        publicClient.readContract({ ...token, functionName: 'FAUCET_AMOUNT' }),
        publicClient.readContract({ ...token, functionName: 'FAUCET_COOLDOWN' }),
        publicClient.readContract({ ...token, functionName: 'FAUCET_CAP' }),
      ]);
      return {
        name,
        symbol,
        decimals: Number(decimals),
        faucetAmount,
        faucetCooldown: Number(faucetCooldown),
        faucetCap,
      };
    },
  });
}

export function useProtocolEvents() {
  return useQuery({
    queryKey: protocolKeys.events,
    enabled: isConfigured,
    staleTime: 10_000,
    refetchInterval: 25_000,
    queryFn: (): Promise<ProtocolEvent[]> => fetchProtocolEvents(publicClient),
  });
}

export function useClaimEvents(claimId?: Hex): {
  events: ProtocolEvent[];
  query: ReturnType<typeof useProtocolEvents>;
} {
  const query = useProtocolEvents();
  const events = (query.data ?? []).filter(
    (event) => event.claimId?.toLowerCase() === claimId?.toLowerCase(),
  );
  return { events, query };
}

/** Re-renders periodically so faucet cooldown copy stays accurate without a page refresh. */
export function useNowSeconds(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
