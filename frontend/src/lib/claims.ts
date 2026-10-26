import type { Address, Hex } from 'viem';
import type { EventTone } from './events';

export enum ClaimStatus {
  None = 0,
  Pending = 1,
  ApprovedReserved = 2,
  Paid = 3,
  Rejected = 4,
  Cancelled = 5,
}

export interface ClaimRecord {
  claimId: Hex;
  claimRefHash: Hex;
  branchCode: number;
  categoryId: number;
  recipient: Address;
  amount: bigint;
  evidenceHash: Hex;
  status: ClaimStatus;
  createdAt: number;
  updatedAt: number;
  createdBy: Address;
}

export interface ClaimsStats {
  total: number;
  pending: number;
  approvedReserved: number;
  paid: number;
  rejected: number;
  cancelled: number;
}

export interface StatusMeta {
  label: string;
  shortLabel: string;
  tone: EventTone;
  description: string;
}

export const STATUS_META: Record<ClaimStatus, StatusMeta> = {
  [ClaimStatus.None]: {
    label: 'Not found',
    shortLabel: 'None',
    tone: 'neutral',
    description: 'No claim exists with this ID.',
  },
  [ClaimStatus.Pending]: {
    label: 'Pending',
    shortLabel: 'Pending',
    tone: 'warning',
    description: 'Awaiting an approver decision. No liquidity is reserved yet.',
  },
  [ClaimStatus.ApprovedReserved]: {
    label: 'Approved & Reserved',
    shortLabel: 'Reserved',
    tone: 'info',
    description: 'Approved with liquidity reserved. Eligible for settlement.',
  },
  [ClaimStatus.Paid]: {
    label: 'Paid',
    shortLabel: 'Paid',
    tone: 'success',
    description: 'Reserved funds were transferred to the recipient.',
  },
  [ClaimStatus.Rejected]: {
    label: 'Rejected',
    shortLabel: 'Rejected',
    tone: 'danger',
    description: 'Rejected by an approver. Terminal state.',
  },
  [ClaimStatus.Cancelled]: {
    label: 'Cancelled',
    shortLabel: 'Cancelled',
    tone: 'neutral',
    description: 'Cancelled before payout. Any reservation was released. Terminal state.',
  },
};

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: String(ClaimStatus.Pending), label: 'Pending' },
  { value: String(ClaimStatus.ApprovedReserved), label: 'Approved & Reserved' },
  { value: String(ClaimStatus.Paid), label: 'Paid' },
  { value: String(ClaimStatus.Rejected), label: 'Rejected' },
  { value: String(ClaimStatus.Cancelled), label: 'Cancelled' },
] as const;

export type ClaimStatusFilter = 'all' | '1' | '2' | '3' | '4' | '5';
export type ClaimSort = 'newest' | 'amount';

export interface ClaimFilterState {
  status: ClaimStatusFilter;
  category: string;
  branch: string;
  search: string;
  sort: ClaimSort;
}

export const DEFAULT_CLAIM_FILTERS: ClaimFilterState = {
  status: 'all',
  category: 'all',
  branch: 'all',
  search: '',
  sort: 'newest',
};

export function filterClaims(claims: ClaimRecord[], filters: ClaimFilterState): ClaimRecord[] {
  const search = filters.search.trim().toLowerCase();
  return claims
    .filter((claim) => {
      if (filters.status !== 'all' && claim.status !== Number(filters.status)) return false;
      if (filters.category !== 'all' && claim.categoryId !== Number(filters.category)) return false;
      if (filters.branch !== 'all' && claim.branchCode !== Number(filters.branch)) return false;
      if (search) {
        const haystack = `${claim.claimId} ${claim.claimRefHash} ${claim.recipient}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === 'amount') {
        return a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1;
      }
      return b.createdAt - a.createdAt;
    });
}

export type ClaimAction = 'approve' | 'reject' | 'cancel' | 'cancel-release' | 'settle';

export interface RoleFlags {
  isOperator: boolean;
  isApprover: boolean;
  isSettler: boolean;
  isCanceller: boolean;
}

export function availableClaimActions(
  claim: ClaimRecord,
  roles: RoleFlags,
  walletAddress: string | undefined,
  allowSelfApproval: boolean,
): ClaimAction[] {
  const actions: ClaimAction[] = [];
  const isCreator = walletAddress?.toLowerCase() === claim.createdBy.toLowerCase();

  if (claim.status === ClaimStatus.Pending) {
    if (roles.isApprover && (allowSelfApproval || !isCreator)) actions.push('approve');
    if (roles.isApprover) actions.push('reject');
    if (roles.isCanceller || (roles.isOperator && isCreator)) actions.push('cancel');
  }

  if (claim.status === ClaimStatus.ApprovedReserved) {
    if (roles.isSettler) actions.push('settle');
    if (roles.isCanceller) actions.push('cancel-release');
  }

  return actions;
}

export function approvedClaims(claims: ClaimRecord[]): ClaimRecord[] {
  return claims.filter((claim) => claim.status === ClaimStatus.ApprovedReserved);
}
