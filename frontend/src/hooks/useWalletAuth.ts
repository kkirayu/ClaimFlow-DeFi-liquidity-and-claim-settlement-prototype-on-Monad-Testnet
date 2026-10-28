import { useConnection } from 'wagmi';
import { CHAIN_ID, CHAIN_NAME } from '@/lib/chain';
import { authBlockReason, deriveAuthState } from '@/lib/auth';
import type { RoleKey } from '@/lib/roles';
import { useRoles } from './useProtocol';

/**
 * One source of truth for role-gated UI. It combines the wallet connection, the configured chain,
 * and the live role read into a fail-closed state. Components should gate on `can*`/`can()` and use
 * `blockReason()` for the disabled-state copy instead of re-deriving role logic.
 */
export function useWalletAuth() {
  const { address, isConnected, chainId } = useConnection();
  const rolesQuery = useRoles(address);

  const auth = deriveAuthState({
    address,
    isConnected,
    walletChainId: chainId,
    expectedChainId: CHAIN_ID,
    expectedChainName: CHAIN_NAME,
    roles: rolesQuery.data,
    rolesPending: rolesQuery.isPending,
    rolesError: rolesQuery.isError,
  });

  return {
    ...auth,
    rolesQuery,
    retryRoles: () => void rolesQuery.refetch(),
    blockReason: (role: RoleKey, capability: string) => authBlockReason(auth, role, capability),
  };
}

export type WalletAuth = ReturnType<typeof useWalletAuth>;
