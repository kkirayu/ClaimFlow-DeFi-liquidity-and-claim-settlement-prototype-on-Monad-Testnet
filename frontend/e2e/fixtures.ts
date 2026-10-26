import { test as base, expect } from '@playwright/test';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type TransactionRequest,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil } from 'viem/chains';

/** Publicly known Anvil account #0. Safe for local E2E only; it holds no real value. */
const ANVIL_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex;
const ANVIL_RPC = process.env.E2E_RPC_URL ?? 'http://127.0.0.1:8545';

type ProviderRequest = { method: string; params?: unknown[] | object };

interface InjectedProviderWindow extends Window {
  __claimflowProviderRequest?: (args: ProviderRequest) => Promise<unknown>;
  ethereum?: Record<string, unknown>;
}

export const test = base.extend<{ wallet: void }>({
  wallet: [
    async ({ page }, use) => {
      const account = privateKeyToAccount(ANVIL_PRIVATE_KEY);
      const transport = http(ANVIL_RPC, { retryCount: 0, timeout: 30_000 });
      const publicClient = createPublicClient({ chain: anvil, transport });
      const walletClient = createWalletClient({ account, chain: anvil, transport });

      const handleRequest = async ({ method, params }: ProviderRequest): Promise<unknown> => {
        switch (method) {
          case 'eth_requestAccounts':
          case 'eth_accounts':
          case 'eth_coinbase':
            return method === 'eth_coinbase' ? account.address : [account.address];
          case 'eth_chainId':
            return `0x${anvil.id.toString(16)}`;
          case 'net_version':
            return String(anvil.id);
          case 'wallet_switchEthereumChain':
          case 'wallet_addEthereumChain':
          case 'wallet_requestPermissions':
            return null;
          case 'eth_sendTransaction': {
            const [raw] = (params as TransactionRequest[]) ?? [];
            if (!raw) throw new Error('Missing transaction parameters.');
            const hash = await walletClient.sendTransaction({
              account,
              chain: anvil,
              to: raw.to,
              data: raw.data,
              value: raw.value === undefined ? undefined : BigInt(raw.value.toString()),
              gas: raw.gas === undefined ? undefined : BigInt(raw.gas.toString()),
            });
            return hash;
          }
          case 'personal_sign': {
            const [message] = (params as [Hex, string]) ?? [];
            if (!message) throw new Error('Missing message to sign.');
            return account.signMessage({ message: { raw: message } });
          }
          default:
            return publicClient.request({
              method: method as never,
              params: params as never,
            });
        }
      };

      await page.exposeFunction('__claimflowProviderRequest', handleRequest);
      await page.addInitScript(() => {
        const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
        const provider = {
          isMetaMask: true,
          isClaimFlowE2E: true,
          request: (args: ProviderRequest) => {
            const handler = (window as InjectedProviderWindow).__claimflowProviderRequest;
            if (!handler) {
              return Promise.reject(new Error('E2E provider bridge is unavailable.'));
            }
            return handler(args);
          },
          on(event: string, listener: (...args: unknown[]) => void) {
            const set = listeners.get(event) ?? new Set();
            set.add(listener);
            listeners.set(event, set);
            return provider;
          },
          removeListener(event: string, listener: (...args: unknown[]) => void) {
            listeners.get(event)?.delete(listener);
            return provider;
          },
          enable: () => provider.request({ method: 'eth_requestAccounts' }),
        };
        Object.defineProperty(window, 'ethereum', {
          value: provider,
          configurable: true,
        });
      });

      await use();
    },
    { auto: true },
  ],
});

export { expect };

export async function rpcIsReachable(): Promise<boolean> {
  try {
    const response = await fetch(ANVIL_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
