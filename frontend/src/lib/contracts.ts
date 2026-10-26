import type { Address } from 'viem';
import { mockUSDCAbi, liquidityVaultAbi, claimManagerAbi } from './abis.generated';
import { addresses } from './chain';

export const TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = 'mUSDC';
export const SHARE_SYMBOL = 'cfmUSDC';
export const BATCH_ALL_OR_NOTHING_COPY =
  'Batch settlement is all-or-nothing. One invalid claim can revert the entire transaction.';

export const tokenContract = addresses.token
  ? ({ address: addresses.token, abi: mockUSDCAbi } as const)
  : undefined;
export const vaultContract = addresses.vault
  ? ({ address: addresses.vault, abi: liquidityVaultAbi } as const)
  : undefined;
export const managerContract = addresses.claimManager
  ? ({ address: addresses.claimManager, abi: claimManagerAbi } as const)
  : undefined;

export const contracts = {
  token: tokenContract,
  vault: vaultContract,
  manager: managerContract,
};

export interface ProtocolContracts {
  token: NonNullable<typeof tokenContract>;
  vault: NonNullable<typeof vaultContract>;
  manager: NonNullable<typeof managerContract>;
}

/**
 * Narrowed accessor for UI code that is rendered behind the deployment configuration gate.
 * Throwing here indicates a programming error, never a user-facing state.
 */
export function requireProtocol(): ProtocolContracts {
  if (!contracts.token || !contracts.vault || !contracts.manager) {
    throw new Error('ClaimFlow contracts are not configured. Deploy the contracts first.');
  }
  return { token: contracts.token, vault: contracts.vault, manager: contracts.manager };
}

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;
export const ZERO_HASH = `0x${'0'.repeat(64)}` as `0x${string}`;

export { mockUSDCAbi, liquidityVaultAbi, claimManagerAbi };
