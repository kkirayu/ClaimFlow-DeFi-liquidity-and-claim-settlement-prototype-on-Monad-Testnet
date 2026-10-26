import { keccak256, toHex, type Hex } from 'viem';
import type { RoleFlags } from './claims';

function roleId(name: string): Hex {
  return keccak256(toHex(name));
}

export const ROLES = {
  admin: roleId('DEFAULT_ADMIN_ROLE'),
  operator: roleId('CLAIM_OPERATOR_ROLE'),
  approver: roleId('CLAIM_APPROVER_ROLE'),
  settler: roleId('SETTLEMENT_ROLE'),
  canceller: roleId('CLAIM_CANCELLER_ROLE'),
  minter: roleId('MINTER_ROLE'),
  manager: roleId('CLAIM_MANAGER_ROLE'),
} as const;

export type RoleKey = 'admin' | 'operator' | 'approver' | 'settler' | 'canceller';

export interface RoleDefinition {
  key: RoleKey;
  label: string;
  description: string;
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: 'operator',
    label: 'Claim Operator',
    description: 'Submit claims and cancel their own pending claims.',
  },
  {
    key: 'approver',
    label: 'Claim Approver',
    description: 'Approve with an atomic liquidity reservation, or reject pending claims.',
  },
  {
    key: 'settler',
    label: 'Settlement Operator',
    description: 'Settle one claim or an all-or-nothing batch of approved claims.',
  },
  {
    key: 'canceller',
    label: 'Claim Canceller',
    description: 'Cancel pending claims and release reservations on approved claims.',
  },
  {
    key: 'admin',
    label: 'Protocol Admin',
    description: 'Manage roles, the batch cap, and the demo self-approval flag.',
  },
];

export interface RolesState extends RoleFlags {
  isAdmin: boolean;
  isConnected: boolean;
}

export const EMPTY_ROLES: RolesState = {
  isOperator: false,
  isApprover: false,
  isSettler: false,
  isCanceller: false,
  isAdmin: false,
  isConnected: false,
};

export const ALLOW_SELF_APPROVAL_COPY =
  'This deployment allows a wallet to approve a claim it created. This is enabled only for single-wallet local demos; the default contract configuration separates the roles.';
