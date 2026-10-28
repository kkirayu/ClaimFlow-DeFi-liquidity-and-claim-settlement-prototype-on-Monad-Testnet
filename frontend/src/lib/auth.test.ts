import { describe, expect, it } from 'vitest';
import type { Address } from 'viem';
import { authBlockReason, deriveAuthState, type AuthSnapshot } from './auth';
import { EMPTY_ROLES, type RolesState } from './roles';

const ADDRESS = '0x1111111111111111111111111111111111111111' as Address;

const BASE: AuthSnapshot = {
  address: ADDRESS,
  isConnected: true,
  walletChainId: 31337,
  expectedChainId: 31337,
  expectedChainName: 'Anvil Local',
  roles: { ...EMPTY_ROLES, isOperator: true },
  rolesPending: false,
  rolesError: false,
};

const GRANTED: RolesState = {
  ...EMPTY_ROLES,
  isOperator: true,
  isApprover: true,
  isSettler: true,
  isCanceller: true,
  isAdmin: true,
};

describe('deriveAuthState', () => {
  it('is disconnected without a wallet even if role data is cached', () => {
    const auth = deriveAuthState({ ...BASE, isConnected: false, roles: GRANTED });
    expect(auth.status).toBe('disconnected');
    expect(auth.canSubmitClaims).toBe(false);
    expect(auth.effectiveRoles).toEqual(EMPTY_ROLES);
  });

  it('fails closed on the wrong network even when the wallet holds the role', () => {
    const auth = deriveAuthState({ ...BASE, walletChainId: 1, roles: GRANTED });
    expect(auth.status).toBe('wrong-network');
    expect(auth.isWrongNetwork).toBe(true);
    expect(auth.canSettleClaims).toBe(false);
    expect(auth.effectiveRoles).toEqual(EMPTY_ROLES);
  });

  it('reports a pending role read as checking rather than unauthorized', () => {
    const auth = deriveAuthState({ ...BASE, roles: undefined, rolesPending: true });
    expect(auth.status).toBe('checking');
    expect(auth.canSubmitClaims).toBe(false);
  });

  it('fails closed when the role read errors, even with stale granted roles', () => {
    const auth = deriveAuthState({ ...BASE, roles: GRANTED, rolesError: true });
    expect(auth.status).toBe('unavailable');
    expect(auth.canSubmitClaims).toBe(false);
    expect(auth.canAdminister).toBe(false);
    expect(auth.effectiveRoles).toEqual(EMPTY_ROLES);
  });

  it('derives every capability from the live roles only when ready', () => {
    const auth = deriveAuthState({ ...BASE, roles: GRANTED });
    expect(auth.status).toBe('ready');
    expect(auth.canSubmitClaims).toBe(true);
    expect(auth.canReviewClaims).toBe(true);
    expect(auth.canSettleClaims).toBe(true);
    expect(auth.canCancelClaims).toBe(true);
    expect(auth.canAdminister).toBe(true);
    expect(auth.can('operator')).toBe(true);
    expect(auth.effectiveRoles).toEqual(GRANTED);
  });

  it('keeps read-only wallets unauthorized without treating them as unauthenticated', () => {
    const auth = deriveAuthState({ ...BASE, roles: EMPTY_ROLES });
    expect(auth.status).toBe('ready');
    expect(auth.isConnected).toBe(true);
    expect(auth.canSubmitClaims).toBe(false);
  });
});

describe('authBlockReason', () => {
  it('returns undefined only when the role check succeeded and the role is granted', () => {
    const auth = deriveAuthState({ ...BASE, roles: GRANTED });
    expect(authBlockReason(auth, 'settler', 'settle claims')).toBeUndefined();
  });

  it('names the missing role and the capability', () => {
    const auth = deriveAuthState({ ...BASE, roles: { ...EMPTY_ROLES, isApprover: false } });
    expect(authBlockReason(auth, 'approver', 'approve claims')).toContain(
      'Claim Approver role required to approve claims',
    );
  });

  it('asks for a wallet, network switch, or retry depending on the state', () => {
    expect(
      authBlockReason(
        deriveAuthState({ ...BASE, isConnected: false }),
        'operator',
        'submit a claim',
      ),
    ).toContain('Connect a wallet');

    expect(
      authBlockReason(deriveAuthState({ ...BASE, walletChainId: 1 }), 'operator', 'submit a claim'),
    ).toContain('Switch your wallet to Anvil Local (chain 31337)');

    expect(
      authBlockReason(deriveAuthState({ ...BASE, rolesError: true }), 'operator', 'submit a claim'),
    ).toContain('Retry the role check');
  });
});
