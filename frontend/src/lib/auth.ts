import type { Address } from 'viem';
import { EMPTY_ROLES, ROLE_DEFINITIONS, type RoleKey, type RolesState } from './roles';

/**
 * Wallet authentication is permissionless on-chain: there is no login server and no session. The
 * only trustworthy statement is "this wallet holds role X on the configured deployment right now".
 *
 * This module derives one explicit state from the wallet connection and the role read so every
 * screen fails closed for the same reasons. A failed, pending, or wrong-network role check never
 * counts as a granted role, even if stale role data is still cached.
 */
export type AuthStatus = 'disconnected' | 'wrong-network' | 'checking' | 'unavailable' | 'ready';

export interface AuthSnapshot {
  address?: Address;
  isConnected: boolean;
  walletChainId?: number;
  expectedChainId: number;
  expectedChainName: string;
  roles?: RolesState;
  rolesPending: boolean;
  rolesError: boolean;
}

export interface AuthState {
  status: AuthStatus;
  address?: Address;
  chainId: number;
  chainName: string;
  roles: RolesState;
  /** Roles that may be used for gating right now. Empty unless the role check succeeded. */
  effectiveRoles: RolesState;
  isConnected: boolean;
  isWrongNetwork: boolean;
  canSubmitClaims: boolean;
  canReviewClaims: boolean;
  canSettleClaims: boolean;
  canCancelClaims: boolean;
  canAdminister: boolean;
  can: (role: RoleKey) => boolean;
}

const ROLE_FLAGS: Record<RoleKey, keyof RolesState> = {
  operator: 'isOperator',
  approver: 'isApprover',
  settler: 'isSettler',
  canceller: 'isCanceller',
  admin: 'isAdmin',
};

const ROLE_LABELS = Object.fromEntries(
  ROLE_DEFINITIONS.map((definition) => [definition.key, definition.label]),
) as Record<RoleKey, string>;

export function deriveAuthState(snapshot: AuthSnapshot): AuthState {
  const roles = snapshot.roles ?? EMPTY_ROLES;
  const status: AuthStatus =
    !snapshot.isConnected || !snapshot.address
      ? 'disconnected'
      : snapshot.walletChainId !== undefined && snapshot.walletChainId !== snapshot.expectedChainId
        ? 'wrong-network'
        : snapshot.rolesError
          ? 'unavailable'
          : snapshot.rolesPending || !snapshot.roles
            ? 'checking'
            : 'ready';

  const ready = status === 'ready';
  const can = (role: RoleKey) => ready && Boolean(roles[ROLE_FLAGS[role]]);

  return {
    status,
    address: snapshot.address,
    chainId: snapshot.expectedChainId,
    chainName: snapshot.expectedChainName,
    roles,
    effectiveRoles: ready ? roles : EMPTY_ROLES,
    isConnected: snapshot.isConnected,
    isWrongNetwork: status === 'wrong-network',
    canSubmitClaims: can('operator'),
    canReviewClaims: can('approver'),
    canSettleClaims: can('settler'),
    canCancelClaims: can('canceller'),
    canAdminister: can('admin'),
    can,
  };
}

/**
 * The human-readable reason a privileged action is unavailable, or `undefined` when it is allowed.
 * `capability` is an infinitive phrase such as "submit a claim" or "settle claims".
 */
export function authBlockReason(
  auth: AuthState,
  role: RoleKey,
  capability: string,
): string | undefined {
  switch (auth.status) {
    case 'ready':
      return auth.can(role)
        ? undefined
        : `Your wallet does not hold the ${ROLE_LABELS[role]} role required to ${capability}.`;
    case 'disconnected':
      return `Connect a wallet to ${capability}.`;
    case 'wrong-network':
      return `Switch your wallet to ${auth.chainName} (chain ${auth.chainId}) to ${capability}.`;
    case 'checking':
      return 'Checking wallet roles…';
    case 'unavailable':
      return `Wallet permissions could not be verified. Retry the role check before you ${capability}.`;
  }
}
