import { createPublicClient, defineChain, http, isAddress, type Address } from 'viem';

const env = import.meta.env;

export const CHAIN_ID = Number(env.VITE_CHAIN_ID ?? 10143);
export const CHAIN_NAME = env.VITE_CHAIN_NAME?.trim() || 'Monad Testnet';
export const NETWORK_LABEL = env.VITE_NETWORK_LABEL?.trim() || CHAIN_NAME;
export const RPC_URL = env.VITE_RPC_URL?.trim() || 'https://testnet-rpc.monad.xyz';
export const EXPLORER_URL = env.VITE_EXPLORER_URL?.trim() || '';
export const EXPLORER_NAME = env.VITE_EXPLORER_NAME?.trim() || 'Explorer';
export const NATIVE_SYMBOL = env.VITE_NATIVE_SYMBOL?.trim() || 'MON';
export const PROVIDER_LABEL = env.VITE_PROVIDER_LABEL?.trim() || 'RPC provider';
export const IS_LOCAL_CHAIN = CHAIN_ID === 31337;

export const chain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: {
    name: NATIVE_SYMBOL === 'MON' ? 'Monad' : NATIVE_SYMBOL,
    symbol: NATIVE_SYMBOL,
    decimals: 18,
  },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: EXPLORER_URL
    ? { default: { name: EXPLORER_NAME, url: EXPLORER_URL } }
    : undefined,
  testnet: true,
});

export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL, { batch: true, retryCount: 2, timeout: 30_000 }),
});

const tokenAddress = env.VITE_MOCK_USDC_ADDRESS?.trim();
const vaultAddress = env.VITE_VAULT_ADDRESS?.trim();
const managerAddress = env.VITE_CLAIM_MANAGER_ADDRESS?.trim();

function validAddress(value: string | undefined): value is Address {
  return Boolean(value && isAddress(value));
}

export const addresses = {
  token: validAddress(tokenAddress) ? tokenAddress : undefined,
  vault: validAddress(vaultAddress) ? vaultAddress : undefined,
  claimManager: validAddress(managerAddress) ? managerAddress : undefined,
} as const;

export const isConfigured = Boolean(addresses.token && addresses.vault && addresses.claimManager);

export const missingConfig = [
  !addresses.token && 'VITE_MOCK_USDC_ADDRESS',
  !addresses.vault && 'VITE_VAULT_ADDRESS',
  !addresses.claimManager && 'VITE_CLAIM_MANAGER_ADDRESS',
].filter(Boolean) as string[];

export const deploymentBlock = BigInt(env.VITE_DEPLOYMENT_BLOCK || '0');

export function explorerTxUrl(hash?: string): string | undefined {
  if (!hash || !EXPLORER_URL) return undefined;
  return `${EXPLORER_URL.replace(/\/$/, '')}/tx/${hash}`;
}

export function explorerAddressUrl(address?: string): string | undefined {
  if (!address || !EXPLORER_URL) return undefined;
  return `${EXPLORER_URL.replace(/\/$/, '')}/address/${address}`;
}

export function explorerBlockUrl(blockNumber?: bigint | number): string | undefined {
  if (blockNumber === undefined || !EXPLORER_URL) return undefined;
  return `${EXPLORER_URL.replace(/\/$/, '')}/block/${blockNumber}`;
}

export function addChainParams() {
  return {
    chainId: `0x${CHAIN_ID.toString(16)}`,
    chainName: CHAIN_NAME,
    nativeCurrency: { name: NATIVE_SYMBOL, symbol: NATIVE_SYMBOL, decimals: 18 },
    rpcUrls: [RPC_URL],
    blockExplorerUrls: EXPLORER_URL ? [EXPLORER_URL] : [],
  };
}
