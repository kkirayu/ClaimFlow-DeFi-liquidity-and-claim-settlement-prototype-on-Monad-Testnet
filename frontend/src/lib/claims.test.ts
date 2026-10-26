import { describe, expect, it } from 'vitest';
import type { Address, Hex } from 'viem';
import {
  ClaimStatus,
  approvedClaims,
  availableClaimActions,
  filterClaims,
  DEFAULT_CLAIM_FILTERS,
  type ClaimRecord,
  type RoleFlags,
} from './claims';

const CREATOR = '0x1111111111111111111111111111111111111111' as Address;
const OTHER = '0x2222222222222222222222222222222222222222' as Address;
const RECIPIENT = '0x3333333333333333333333333333333333333333' as Address;

function claim(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
  return {
    claimId: `0x${'11'.repeat(32)}` as Hex,
    claimRefHash: `0x${'22'.repeat(32)}` as Hex,
    branchCode: 101,
    categoryId: 1,
    recipient: RECIPIENT,
    amount: 1_000_000n,
    evidenceHash: `0x${'0'.repeat(64)}` as Hex,
    status: ClaimStatus.Pending,
    createdAt: 1_000,
    updatedAt: 1_000,
    createdBy: CREATOR,
    ...overrides,
  };
}

const NO_ROLES: RoleFlags = {
  isOperator: false,
  isApprover: false,
  isSettler: false,
  isCanceller: false,
};

const ALL_ROLES: RoleFlags = {
  isOperator: true,
  isApprover: true,
  isSettler: true,
  isCanceller: true,
};

describe('filterClaims', () => {
  const claims = [
    claim({
      claimId: `0x${'aa'.repeat(32)}` as Hex,
      branchCode: 101,
      categoryId: 1,
      createdAt: 10,
    }),
    claim({
      claimId: `0x${'bb'.repeat(32)}` as Hex,
      branchCode: 102,
      categoryId: 2,
      status: ClaimStatus.Paid,
      createdAt: 20,
      amount: 5_000_000n,
    }),
    claim({
      claimId: `0x${'cc'.repeat(32)}` as Hex,
      branchCode: 101,
      categoryId: 2,
      status: ClaimStatus.Rejected,
      createdAt: 30,
      amount: 2_000_000n,
    }),
  ];

  it('returns everything for the default filters, newest first', () => {
    const result = filterClaims(claims, DEFAULT_CLAIM_FILTERS);
    expect(result.map((item) => item.createdAt)).toEqual([30, 20, 10]);
  });

  it('filters by status, category, and branch together', () => {
    const result = filterClaims(claims, {
      ...DEFAULT_CLAIM_FILTERS,
      status: '4',
      category: '2',
      branch: '101',
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe(ClaimStatus.Rejected);
  });

  it('searches claim IDs and recipients case-insensitively', () => {
    expect(filterClaims(claims, { ...DEFAULT_CLAIM_FILTERS, search: 'BBBB' })).toHaveLength(1);
    expect(filterClaims(claims, { ...DEFAULT_CLAIM_FILTERS, search: RECIPIENT })).toHaveLength(3);
    expect(filterClaims(claims, { ...DEFAULT_CLAIM_FILTERS, search: 'not-present' })).toHaveLength(
      0,
    );
  });

  it('sorts by amount when requested', () => {
    const result = filterClaims(claims, { ...DEFAULT_CLAIM_FILTERS, sort: 'amount' });
    expect(result.map((item) => item.amount)).toEqual([5_000_000n, 2_000_000n, 1_000_000n]);
  });
});

describe('availableClaimActions', () => {
  it('lets an approver approve and reject a pending claim', () => {
    const actions = availableClaimActions(claim(), ALL_ROLES, OTHER, false);
    expect(actions).toEqual(['approve', 'reject', 'cancel']);
  });

  it('blocks self-approval by default but allows it in a demo deployment', () => {
    const approverRoles = { ...NO_ROLES, isApprover: true };
    expect(availableClaimActions(claim(), approverRoles, CREATOR, false)).toEqual(['reject']);
    expect(availableClaimActions(claim(), approverRoles, CREATOR, true)).toEqual([
      'approve',
      'reject',
    ]);
  });

  it('lets an operator cancel only their own pending claim', () => {
    const operatorRoles = { ...NO_ROLES, isOperator: true };
    expect(availableClaimActions(claim(), operatorRoles, CREATOR, false)).toEqual(['cancel']);
    expect(availableClaimActions(claim(), operatorRoles, OTHER, false)).toEqual([]);
  });

  it('offers settlement and reserved cancellation only for reserved claims', () => {
    const reserved = claim({ status: ClaimStatus.ApprovedReserved });
    expect(availableClaimActions(reserved, ALL_ROLES, OTHER, false)).toEqual([
      'settle',
      'cancel-release',
    ]);
    expect(
      availableClaimActions(claim({ status: ClaimStatus.Paid }), ALL_ROLES, OTHER, false),
    ).toEqual([]);
  });

  it('returns no actions without roles', () => {
    expect(availableClaimActions(claim(), NO_ROLES, CREATOR, true)).toEqual([]);
  });
});

describe('approvedClaims', () => {
  it('selects only approved and reserved claims', () => {
    const result = approvedClaims([
      claim(),
      claim({ status: ClaimStatus.ApprovedReserved }),
      claim({ status: ClaimStatus.Paid }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe(ClaimStatus.ApprovedReserved);
  });
});
