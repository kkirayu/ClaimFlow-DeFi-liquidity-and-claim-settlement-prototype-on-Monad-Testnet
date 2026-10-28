import { test as base, expect, type Page } from '@playwright/test';
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseUnits,
  toHex,
  type Address,
  type Hex,
  type TransactionRequest,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil } from 'viem/chains';
import { loadEnv } from 'vite';
import { claimManagerAbi, liquidityVaultAbi, mockUSDCAbi } from '../src/lib/abis.generated';

const env = loadEnv('development', process.cwd(), 'VITE_');
const ANVIL_RPC = process.env.E2E_RPC_URL ?? env.VITE_RPC_URL ?? 'http://127.0.0.1:8545';

/**
 * Standard, publicly known Anvil accounts. These keys are printed by Anvil on startup and hold no
 * real value. Tests use distinct accounts so role boundaries are exercised for real.
 */
export const ACCOUNTS = {
  admin: {
    key: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex,
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
  },
  operator: {
    key: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex,
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address,
  },
  approver: {
    key: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as Hex,
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Address,
  },
  settler: {
    key: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' as Hex,
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as Address,
  },
  viewer: {
    key: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a' as Hex,
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65' as Address,
  },
} as const;

export type AccountName = keyof typeof ACCOUNTS;

export const ROLE_NAMES = {
  operator: 'CLAIM_OPERATOR_ROLE',
  approver: 'CLAIM_APPROVER_ROLE',
  settler: 'SETTLEMENT_ROLE',
  canceller: 'CLAIM_CANCELLER_ROLE',
} as const;

type ProviderRequest = { method: string; params?: unknown[] | object };

interface InjectedProviderWindow extends Window {
  __claimflowProviderRequest?: (args: ProviderRequest) => Promise<unknown>;
  __claimflowSetAccount?: (name: AccountName) => Promise<Address>;
  __claimflowUseAccount?: (name: AccountName) => Promise<Address>;
  ethereum?: Record<string, unknown>;
}

const transport = http(ANVIL_RPC, { retryCount: 0, timeout: 30_000 });
export const publicClient = createPublicClient({ chain: anvil, transport });

function walletFor(name: AccountName) {
  const account = privateKeyToAccount(ACCOUNTS[name].key);
  return createWalletClient({ account, chain: anvil, transport });
}

export const deployment = {
  token: env.VITE_MOCK_USDC_ADDRESS as Address | undefined,
  vault: env.VITE_VAULT_ADDRESS as Address | undefined,
  manager: env.VITE_CLAIM_MANAGER_ADDRESS as Address | undefined,
};

export interface WalletFixture {
  address: Address;
  /** Switches the injected provider to another account and notifies wagmi listeners. */
  useAccount: (name: AccountName) => Promise<void>;
}

export const test = base.extend<{ wallet: WalletFixture }>({
  wallet: [
    async ({ page }, use) => {
      let current: AccountName = 'admin';

      const handleRequest = async ({ method, params }: ProviderRequest): Promise<unknown> => {
        const account = privateKeyToAccount(ACCOUNTS[current].key);
        const walletClient = walletFor(current);

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
            const request = {
              account,
              chain: anvil,
              to: raw.to,
              data: raw.data,
              value: raw.value === undefined ? undefined : BigInt(raw.value.toString()),
            } as const;
            // Estimate a tight gas limit when the wallet did not provide one. Monad charges the
            // limit, so an inflated fallback is never acceptable.
            const gas =
              raw.gas !== undefined
                ? BigInt(raw.gas.toString())
                : ((await publicClient.estimateGas({ ...request, account })) * 11n) / 10n;
            return walletClient.sendTransaction({ ...request, gas });
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
      await page.exposeFunction('__claimflowSetAccount', async (name: AccountName) => {
        current = name;
        return ACCOUNTS[name].address;
      });
      await page.addInitScript(() => {
        const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
        const emit = (event: string, payload: unknown) => {
          for (const listener of listeners.get(event) ?? []) listener(payload);
        };
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
        (window as InjectedProviderWindow).__claimflowUseAccount = async (name: AccountName) => {
          const setter = (window as InjectedProviderWindow).__claimflowSetAccount;
          if (!setter) throw new Error('E2E account bridge is unavailable.');
          const address = await setter(name);
          emit('accountsChanged', [address]);
          return address;
        };
      });

      await use({
        address: ACCOUNTS.admin.address,
        useAccount: async (name) => {
          await page.evaluate((accountName) => {
            const bridge = (window as InjectedProviderWindow).__claimflowUseAccount;
            if (!bridge) {
              throw new Error(
                'E2E account bridge is unavailable; navigate to the app before switching accounts.',
              );
            }
            return bridge(accountName);
          }, name);
        },
      });
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

function requireDeployment() {
  if (!deployment.token || !deployment.vault || !deployment.manager) {
    throw new Error(
      'E2E requires VITE_MOCK_USDC_ADDRESS, VITE_VAULT_ADDRESS, and VITE_CLAIM_MANAGER_ADDRESS in frontend/.env.local. Run pnpm dev:local first.',
    );
  }
  return deployment as { token: Address; vault: Address; manager: Address };
}

export function roleId(name: keyof typeof ROLE_NAMES): Hex {
  return keccak256(toHex(ROLE_NAMES[name]));
}

/** Grants each Anvil test account exactly one protocol role. Idempotent. */
export async function ensureRoleAccounts(): Promise<void> {
  const { manager } = requireDeployment();
  const admin = walletFor('admin');
  const assignments: Array<[AccountName, keyof typeof ROLE_NAMES]> = [
    ['operator', 'operator'],
    ['approver', 'approver'],
    ['settler', 'settler'],
  ];

  for (const [accountName, roleName] of assignments) {
    const role = roleId(roleName);
    const address = ACCOUNTS[accountName].address;
    const hasRole = await publicClient.readContract({
      address: manager,
      abi: claimManagerAbi,
      functionName: 'hasRole',
      args: [role, address],
    });
    if (hasRole) continue;

    const hash = await admin.writeContract({
      address: manager,
      abi: claimManagerAbi,
      functionName: 'grantRole',
      args: [role, address],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(
        `Could not grant ${roleName} to ${address}. The E2E admin account is not DEFAULT_ADMIN_ROLE.`,
      );
    }
  }
}

/** Ensures the vault can reserve the claim used by the business-flow test. */
export async function ensureVaultLiquidity(minimum = parseUnits('250', 6)): Promise<void> {
  const { token, vault } = requireDeployment();
  const admin = walletFor('admin');
  const available = await publicClient.readContract({
    address: vault,
    abi: liquidityVaultAbi,
    functionName: 'availableLiquidity',
  });
  if (available >= minimum) return;

  const depositAmount = parseUnits('500', 6);
  const balance = await publicClient.readContract({
    address: token,
    abi: mockUSDCAbi,
    functionName: 'balanceOf',
    args: [admin.account.address],
  });
  if (balance < depositAmount) {
    const mintHash = await admin.writeContract({
      address: token,
      abi: mockUSDCAbi,
      functionName: 'mint',
      args: [admin.account.address, depositAmount - balance],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
  }

  const allowance = await publicClient.readContract({
    address: token,
    abi: mockUSDCAbi,
    functionName: 'allowance',
    args: [admin.account.address, vault],
  });
  if (allowance < depositAmount) {
    const approveHash = await admin.writeContract({
      address: token,
      abi: mockUSDCAbi,
      functionName: 'approve',
      args: [vault, depositAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const depositHash = await admin.writeContract({
    address: vault,
    abi: liquidityVaultAbi,
    functionName: 'deposit',
    args: [depositAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
}

export async function tokenBalance(address: Address): Promise<bigint> {
  const { token } = requireDeployment();
  return publicClient.readContract({
    address: token,
    abi: mockUSDCAbi,
    functionName: 'balanceOf',
    args: [address],
  });
}

export async function readClaim(claimId: Hex) {
  const { manager } = requireDeployment();
  return publicClient.readContract({
    address: manager,
    abi: claimManagerAbi,
    functionName: 'claims',
    args: [claimId],
  });
}

/** Returns every claim ID currently stored by ClaimManager, oldest first. */
export async function claimIds(): Promise<Hex[]> {
  const { manager } = requireDeployment();
  const count = await publicClient.readContract({
    address: manager,
    abi: claimManagerAbi,
    functionName: 'claimCount',
  });
  if (count === 0n) return [];
  const ids = await publicClient.readContract({
    address: manager,
    abi: claimManagerAbi,
    functionName: 'getClaimIds',
    args: [0n, count],
  });
  return [...ids];
}

/** Signs in as the requested account, reloading so wagmi reconnects with the new address. */
export async function signInAs(
  page: Page,
  wallet: WalletFixture,
  name: AccountName,
): Promise<void> {
  // The injected provider lives in an init script, so it only exists on real app documents.
  // Navigate first when starting from about:blank, then switch accounts and clear wagmi's cached
  // connection so the app re-authenticates against the new account instead of a stale one.
  if (!page.url().startsWith('http')) {
    await page.goto('/claims', { waitUntil: 'domcontentloaded' });
  }
  await wallet.useAccount(name);
  await page.evaluate(() => window.localStorage.removeItem('wagmi.store'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  const prefix = ACCOUNTS[name].address.slice(0, 6);
  const connected = page.getByRole('button', { name: new RegExp(prefix, 'i') }).first();
  const connect = page.getByRole('button', { name: 'Connect wallet' }).first();

  try {
    await connected.waitFor({ state: 'visible', timeout: 3_000 });
  } catch {
    await connect.click();
    await connected.waitFor({ state: 'visible', timeout: 15_000 });
  }
}

export function shortAccount(name: AccountName): string {
  const address = ACCOUNTS[name].address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
