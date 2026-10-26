import {
  getNetwork,
  loadArtifact,
  loadEnv,
  makeClients,
  waitForRpc,
  writeDeployment,
  writeFrontendEnv,
} from './lib/network.mjs';
import { isAddress, keccak256, toHex } from 'viem';

const ROLE = {
  CLAIM_MANAGER_ROLE: keccak256(toHex('CLAIM_MANAGER_ROLE')),
  CLAIM_OPERATOR_ROLE: keccak256(toHex('CLAIM_OPERATOR_ROLE')),
  CLAIM_APPROVER_ROLE: keccak256(toHex('CLAIM_APPROVER_ROLE')),
  SETTLEMENT_ROLE: keccak256(toHex('SETTLEMENT_ROLE')),
  CLAIM_CANCELLER_ROLE: keccak256(toHex('CLAIM_CANCELLER_ROLE')),
};

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : fallback;
}

function boolValue(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function roleAddress(value, fallback) {
  if (!value) return fallback;
  if (!isAddress(value)) throw new Error(`Invalid role address: ${value}`);
  return value;
}

export async function deploy({ networkName, seed = false, writeEnv = true }) {
  loadEnv();
  const config = getNetwork(networkName);
  const tokenArtifact = loadArtifact('MockUSDC');
  const vaultArtifact = loadArtifact('LiquidityVault');
  const managerArtifact = loadArtifact('ClaimManager');

  const { publicClient, walletClient, account, chain } = await makeClients(config);
  const accountAddress = walletClient.account.address;

  console.log(`\nClaimFlow deployment`);
  console.log(`  network      ${config.networkLabel} (chain ${config.chainId})`);
  console.log(`  rpc          ${config.rpcUrl}`);
  console.log(`  deployer     ${accountAddress}`);
  console.log(`  admin        ${accountAddress}\n`);

  await waitForRpc(publicClient);
  const rpcChainId = await publicClient.getChainId();
  if (rpcChainId !== config.chainId) {
    throw new Error(
      `RPC chain id ${rpcChainId} does not match expected ${config.chainId}. Check LOCAL_RPC_URL / MONAD_RPC_URL.`,
    );
  }

  if (!config.isLocal) {
    const balance = await publicClient.getBalance({ address: accountAddress });
    if (balance === 0n) {
      throw new Error(
        'The deployer has 0 MON on Monad Testnet. Fund it from https://faucet.monad.xyz before deploying.',
      );
    }
  }

  const tokenTx = await walletClient.deployContract({
    abi: tokenArtifact.abi,
    bytecode: tokenArtifact.bytecode,
    args: [accountAddress],
  });
  const tokenReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenTx });
  if (!tokenReceipt.contractAddress) throw new Error('MockUSDC deployment returned no address.');

  const vaultTx = await walletClient.deployContract({
    abi: vaultArtifact.abi,
    bytecode: vaultArtifact.bytecode,
    args: [tokenReceipt.contractAddress, accountAddress],
  });
  const vaultReceipt = await publicClient.waitForTransactionReceipt({ hash: vaultTx });
  if (!vaultReceipt.contractAddress)
    throw new Error('LiquidityVault deployment returned no address.');

  const managerTx = await walletClient.deployContract({
    abi: managerArtifact.abi,
    bytecode: managerArtifact.bytecode,
    args: [vaultReceipt.contractAddress, accountAddress],
  });
  const managerReceipt = await publicClient.waitForTransactionReceipt({ hash: managerTx });
  if (!managerReceipt.contractAddress)
    throw new Error('ClaimManager deployment returned no address.');

  const mockUSDC = tokenReceipt.contractAddress;
  const liquidityVault = vaultReceipt.contractAddress;
  const claimManager = managerReceipt.contractAddress;

  console.log(`  MockUSDC       ${mockUSDC}`);
  console.log(`  LiquidityVault ${liquidityVault}`);
  console.log(`  ClaimManager   ${claimManager}`);

  const operator = roleAddress(process.env.CLAIM_OPERATOR_ADDRESS, accountAddress);
  const approver = roleAddress(process.env.CLAIM_APPROVER_ADDRESS, accountAddress);
  const settler = roleAddress(process.env.SETTLEMENT_ADDRESS, accountAddress);
  const canceller = roleAddress(process.env.CLAIM_CANCELLER_ADDRESS, accountAddress);
  const allowSelfApproval = boolValue(process.env.ALLOW_SELF_APPROVAL, config.isLocal);
  const maxBatchSize = Number.parseInt(process.env.MAX_BATCH_SIZE || '20', 10);
  if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1 || maxBatchSize > 50) {
    throw new Error('MAX_BATCH_SIZE must be an integer between 1 and 50.');
  }

  const grant = async (label, address, contract, abi, role) => {
    const hash = await walletClient.writeContract({
      address: contract,
      abi,
      functionName: 'grantRole',
      args: [role, address],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`${label} grant reverted.`);
    console.log(`  role ${label.padEnd(18)} ${address}`);
    return hash;
  };

  console.log('\nConfiguring roles');
  const managerRoleTx = await grant(
    'CLAIM_MANAGER_ROLE',
    claimManager,
    liquidityVault,
    vaultArtifact.abi,
    ROLE.CLAIM_MANAGER_ROLE,
  );
  const operatorTx = await grant(
    'CLAIM_OPERATOR_ROLE',
    operator,
    claimManager,
    managerArtifact.abi,
    ROLE.CLAIM_OPERATOR_ROLE,
  );
  const approverTx = await grant(
    'CLAIM_APPROVER_ROLE',
    approver,
    claimManager,
    managerArtifact.abi,
    ROLE.CLAIM_APPROVER_ROLE,
  );
  const settlerTx = await grant(
    'SETTLEMENT_ROLE',
    settler,
    claimManager,
    managerArtifact.abi,
    ROLE.SETTLEMENT_ROLE,
  );
  const cancellerTx = await grant(
    'CLAIM_CANCELLER_ROLE',
    canceller,
    claimManager,
    managerArtifact.abi,
    ROLE.CLAIM_CANCELLER_ROLE,
  );

  let selfApprovalTx = null;
  if (allowSelfApproval) {
    selfApprovalTx = await walletClient.writeContract({
      address: claimManager,
      abi: managerArtifact.abi,
      functionName: 'setAllowSelfApproval',
      args: [true],
    });
    await publicClient.waitForTransactionReceipt({ hash: selfApprovalTx });
    console.log('  self-approval      enabled (demo single-signer configuration)');
  }

  let batchSizeTx = null;
  if (maxBatchSize !== 20) {
    batchSizeTx = await walletClient.writeContract({
      address: claimManager,
      abi: managerArtifact.abi,
      functionName: 'setMaxBatchSize',
      args: [BigInt(maxBatchSize)],
    });
    await publicClient.waitForTransactionReceipt({ hash: batchSizeTx });
    console.log(`  max batch size     ${maxBatchSize}`);
  }

  const deployment = {
    network: config.name,
    chainId: config.chainId,
    chainName: config.chainName,
    rpcProvider: config.providerLabel,
    explorerUrl: config.explorerUrl,
    contracts: {
      mockUSDC,
      liquidityVault,
      claimManager,
    },
    deploymentBlock: Number(tokenReceipt.blockNumber),
    deployer: accountAddress,
    roles: { operator, approver, settler, canceller },
    allowSelfApproval,
    maxBatchSize,
    deployedAt: new Date().toISOString(),
    transactions: {
      mockUSDC: tokenTx,
      liquidityVault: vaultTx,
      claimManager: managerTx,
      claimManagerRole: managerRoleTx,
      operatorRole: operatorTx,
      approverRole: approverTx,
      settlementRole: settlerTx,
      cancellerRole: cancellerTx,
      selfApproval: selfApprovalTx,
      batchSize: batchSizeTx,
    },
  };

  const file = writeDeployment(config.chainId, deployment);
  console.log(`\nDeployment written to ${file}`);

  if (writeEnv) {
    const envFile = writeFrontendEnv(config, deployment);
    console.log(`Frontend config written to ${envFile}`);
  }

  console.log(`\nExplorer: ${config.explorerUrl || 'not available on local Anvil'}`);
  console.log(`Chain ID: ${config.chainId}\n`);

  if (seed) {
    const { seedDemo } = await import('./seed.mjs');
    await seedDemo({ networkName, deploymentFile: file });
  }

  return { deployment, file, chain };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const networkName = argValue('--network', 'local');
  const seed = process.argv.includes('--seed');
  const writeEnv = !process.argv.includes('--no-write-env');
  deploy({ networkName, seed, writeEnv }).catch((error) => {
    console.error(`\nDeployment failed: ${error.shortMessage || error.message}`);
    if (error.details) console.error(error.details);
    process.exitCode = 1;
  });
}
