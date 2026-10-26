import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, defineChain, http, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const ARTIFACT_DIR = path.join(ROOT, 'contracts', 'out');
export const DEPLOYMENT_DIR = path.join(ROOT, 'deployments');

/** Publicly known Anvil account #0. It is a development address, not a secret. */
export const ANVIL_ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

export function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    const fullPath = path.join(ROOT, file);
    if (fs.existsSync(fullPath)) {
      try {
        process.loadEnvFile(fullPath);
      } catch {
        // Ignore malformed/duplicate env lines; deployment output will point at missing values.
      }
    }
  }
}

export function loadArtifact(name) {
  const file = path.join(ARTIFACT_DIR, `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing contract artifact ${file}. Run "pnpm contracts:build" before deploying.`,
    );
  }
  const artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { abi: artifact.abi, bytecode: artifact.bytecode.object };
}

export function getNetwork(name) {
  if (name === 'local') {
    const rpcUrl = process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545';
    return {
      name: 'local',
      chainId: 31337,
      chainName: 'Anvil Local',
      networkLabel: 'Anvil Local',
      rpcUrl,
      explorerUrl: '',
      explorerName: '',
      nativeSymbol: 'MON',
      providerLabel: 'Local Anvil RPC',
      isLocal: true,
    };
  }

  if (name === 'testnet') {
    return {
      name: 'monad-testnet',
      chainId: 10143,
      chainName: 'Monad Testnet',
      networkLabel: 'Monad Testnet',
      rpcUrl: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
      explorerUrl: 'https://testnet.monadscan.com',
      explorerName: 'Monadscan',
      nativeSymbol: 'MON',
      providerLabel: 'QuickNode public RPC',
      isLocal: false,
    };
  }

  throw new Error(`Unknown network "${name}". Use "local" or "testnet".`);
}

export function makeChain(config) {
  return defineChain({
    id: config.chainId,
    name: config.chainName,
    nativeCurrency: {
      name: config.nativeSymbol === 'MON' ? 'Monad' : config.nativeSymbol,
      symbol: config.nativeSymbol,
      decimals: 18,
    },
    rpcUrls: { default: { http: [config.rpcUrl] } },
    blockExplorers: config.explorerUrl
      ? { default: { name: config.explorerName || 'Explorer', url: config.explorerUrl } }
      : undefined,
    testnet: true,
  });
}

export async function makeClients(config, options = {}) {
  const chain = makeChain(config);
  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl, { retryCount: 2, timeout: 30_000 }),
  });

  let account;
  if (config.isLocal) {
    const address = options.address || process.env.DEPLOYER_ADDRESS || ANVIL_ACCOUNT;
    if (!isAddress(address)) throw new Error(`Invalid DEPLOYER_ADDRESS: ${address}`);
    account = { address, type: 'json-rpc' };
  } else {
    const key = options.privateKey || process.env.PRIVATE_KEY;
    if (!key) {
      throw new Error(
        'PRIVATE_KEY is required for Monad Testnet. Copy .env.example to .env and add a dedicated funded testnet key.',
      );
    }
    account = privateKeyToAccount(key.startsWith('0x') ? key : `0x${key}`);
  }

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl, { retryCount: 2, timeout: 30_000 }),
  });

  return { chain, publicClient, walletClient, account };
}

export async function waitForRpc(publicClient, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      await publicClient.getBlockNumber();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error('RPC did not become available in time.');
}

export function deploymentPath(chainId) {
  return path.join(DEPLOYMENT_DIR, `${chainId}.json`);
}

export function readDeployment(chainId) {
  const file = deploymentPath(chainId);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing deployment ${file}. Deploy the contracts first.`);
  }
  return { file, deployment: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

export function writeDeployment(chainId, deployment) {
  fs.mkdirSync(DEPLOYMENT_DIR, { recursive: true });
  const file = deploymentPath(chainId);
  fs.writeFileSync(file, `${JSON.stringify(deployment, null, 2)}\n`);
  return file;
}

/** Merge only the keys ClaimFlow owns, so a WalletConnect key or local tweak survives. */
export function writeFrontendEnv(config, deployment) {
  const file = path.join(ROOT, 'frontend', '.env.local');
  const managed = {
    VITE_CHAIN_ID: String(config.chainId),
    VITE_CHAIN_NAME: config.chainName,
    VITE_RPC_URL: config.rpcUrl,
    VITE_EXPLORER_URL: config.explorerUrl,
    VITE_EXPLORER_NAME: config.explorerName,
    VITE_NATIVE_SYMBOL: config.nativeSymbol,
    VITE_NETWORK_LABEL: config.networkLabel,
    VITE_PROVIDER_LABEL: config.providerLabel,
    VITE_MOCK_USDC_ADDRESS: deployment.contracts.mockUSDC,
    VITE_VAULT_ADDRESS: deployment.contracts.liquidityVault,
    VITE_CLAIM_MANAGER_ADDRESS: deployment.contracts.claimManager,
    VITE_DEPLOYMENT_BLOCK: String(deployment.deploymentBlock),
  };

  const preserved = [];
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const key = line.split('=')[0]?.trim();
      if (key && !(key in managed) && !line.startsWith('#')) preserved.push(line);
    }
  }

  const header = [
    '# Generated by scripts/deploy.mjs. Public values only — never add private keys here.',
    '# This file is gitignored.',
    '',
  ];
  const body = Object.entries(managed).map(([key, value]) => `${key}=${value}`);
  fs.writeFileSync(file, `${[...header, ...body, ...preserved].join('\n')}\n`);
  return file;
}

export function explorerTx(config, hash) {
  return config.explorerUrl ? `${config.explorerUrl}/tx/${hash}` : '';
}

export async function sendAndWait(walletClient, publicClient, request) {
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error(`Transaction ${hash} reverted.`);
  }
  return receipt;
}
