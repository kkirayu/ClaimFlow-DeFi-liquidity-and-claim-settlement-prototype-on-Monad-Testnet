import { randomBytes } from 'node:crypto';
import {
  getNetwork,
  loadArtifact,
  loadEnv,
  makeClients,
  readDeployment,
  waitForRpc,
} from './lib/network.mjs';
import { formatUnits, keccak256, parseUnits, toHex } from 'viem';

const ROLE = {
  MINTER_ROLE: keccak256(toHex('MINTER_ROLE')),
  CLAIM_OPERATOR_ROLE: keccak256(toHex('CLAIM_OPERATOR_ROLE')),
  CLAIM_APPROVER_ROLE: keccak256(toHex('CLAIM_APPROVER_ROLE')),
  SETTLEMENT_ROLE: keccak256(toHex('SETTLEMENT_ROLE')),
};

const theseClaims = [
  { amount: 12_500n, branch: 101, category: 1, evidence: true },
  { amount: 8_750n, branch: 102, category: 2, evidence: true },
  { amount: 5_250n, branch: 103, category: 1, evidence: false },
  { amount: 3_400n, branch: 101, category: 3, evidence: false },
  { amount: 4_100n, branch: 102, category: 4, evidence: true },
];

function randomBytes32() {
  return `0x${randomBytes(32).toString('hex')}`;
}

async function wait(walletClient, publicClient, request, label) {
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${label} reverted (${hash}).`);
  return hash;
}

export async function seedDemo({ networkName, deploymentFile } = {}) {
  loadEnv();
  const config = getNetwork(networkName || 'local');
  const { deployment } = readDeployment(config.chainId);
  const tokenArtifact = loadArtifact('MockUSDC');
  const vaultArtifact = loadArtifact('LiquidityVault');
  const managerArtifact = loadArtifact('ClaimManager');

  const { publicClient, walletClient } = await makeClients(config, {
    address: deployment.deployer,
  });
  await waitForRpc(publicClient);
  const account = walletClient.account.address;

  const token = { address: deployment.contracts.mockUSDC, abi: tokenArtifact.abi };
  const vault = { address: deployment.contracts.liquidityVault, abi: vaultArtifact.abi };
  const manager = { address: deployment.contracts.claimManager, abi: managerArtifact.abi };

  console.log(`\nSeeding demo data on ${config.networkLabel}`);
  console.log(`  signer ${account}`);

  const hasRole = async (contract, role) =>
    publicClient.readContract({
      ...contract,
      functionName: 'hasRole',
      args: [role, account],
    });

  const isOperator = await hasRole(manager, ROLE.CLAIM_OPERATOR_ROLE);
  const isApprover = await hasRole(manager, ROLE.CLAIM_APPROVER_ROLE);
  const isSettler = await hasRole(manager, ROLE.SETTLEMENT_ROLE);
  const isMinter = await hasRole(token, ROLE.MINTER_ROLE);
  const allowSelfApproval = await publicClient.readContract({
    ...manager,
    functionName: 'allowSelfApproval',
  });

  const depositAmount = parseUnits('100000', 6);
  const shares = await publicClient.readContract({
    ...vault,
    functionName: 'sharesOf',
    args: [account],
  });

  if (shares === 0n) {
    let balance = await publicClient.readContract({
      ...token,
      functionName: 'balanceOf',
      args: [account],
    });

    if (balance < depositAmount) {
      if (isMinter) {
        await wait(
          walletClient,
          publicClient,
          {
            ...token,
            functionName: 'mint',
            args: [account, depositAmount - balance],
          },
          'mint',
        );
      } else {
        await wait(walletClient, publicClient, { ...token, functionName: 'faucet' }, 'faucet');
        balance = await publicClient.readContract({
          ...token,
          functionName: 'balanceOf',
          args: [account],
        });
      }
    }

    const allowance = await publicClient.readContract({
      ...token,
      functionName: 'allowance',
      args: [account, vault.address],
    });
    if (allowance < depositAmount) {
      await wait(
        walletClient,
        publicClient,
        {
          ...token,
          functionName: 'approve',
          args: [vault.address, depositAmount],
        },
        'approve',
      );
    }

    await wait(
      walletClient,
      publicClient,
      { ...vault, functionName: 'deposit', args: [depositAmount] },
      'deposit',
    );
    console.log(`  deposited 100,000 mUSDC into the vault`);
  } else {
    console.log(
      `  vault position already exists (${formatUnits(shares, 6)} shares); skipping deposit`,
    );
  }

  const claimCount = await publicClient.readContract({
    ...manager,
    functionName: 'claimCount',
  });

  if (claimCount > 0n) {
    console.log(`  ${claimCount} claims already exist; skipping claim seed`);
    printSummary(publicClient, manager);
    return;
  }

  if (!isOperator) {
    console.warn('  signer lacks CLAIM_OPERATOR_ROLE; cannot seed claims. Grant the role first.');
    return;
  }

  console.log('  submitting synthetic claims (opaque hashes only, no personal data)');
  const claimIds = [];
  for (let i = 0; i < theseClaims.length; i++) {
    const item = theseClaims[i];
    const claimId = randomBytes32();
    const refHash = randomBytes32();
    const evidenceHash = item.evidence ? randomBytes32() : `0x${'0'.repeat(64)}`;

    await wait(
      walletClient,
      publicClient,
      {
        ...manager,
        functionName: 'submitClaim',
        args: [
          claimId,
          refHash,
          item.branch,
          item.category,
          account,
          item.amount * 1_000_000n,
          evidenceHash,
        ],
      },
      `submit claim ${i + 1}`,
    );
    claimIds.push(claimId);
  }

  if (!isApprover) {
    console.warn('  signer lacks CLAIM_APPROVER_ROLE; claims left pending.');
    printSummary(publicClient, manager);
    return;
  }

  if (!allowSelfApproval) {
    console.warn(
      '  allowSelfApproval is false and the seeder created the claims. Approvals were skipped.\n' +
        '  Set ALLOW_SELF_APPROVAL=true for a single-signer demo, or seed with distinct role accounts.',
    );
    printSummary(publicClient, manager);
    return;
  }

  console.log('  approving claims 1 and 2 (reserve), rejecting claim 4, paying claim 5');
  for (const index of [0, 1]) {
    await wait(
      walletClient,
      publicClient,
      { ...manager, functionName: 'approveClaim', args: [claimIds[index]] },
      `approve claim ${index + 1}`,
    );
  }
  await wait(
    walletClient,
    publicClient,
    { ...manager, functionName: 'rejectClaim', args: [claimIds[3]] },
    'reject claim 4',
  );

  if (isSettler) {
    await wait(
      walletClient,
      publicClient,
      { ...manager, functionName: 'approveClaim', args: [claimIds[4]] },
      'approve claim 5',
    );
    await wait(
      walletClient,
      publicClient,
      { ...manager, functionName: 'settleClaim', args: [claimIds[4]] },
      'settle claim 5',
    );
  } else {
    console.warn('  signer lacks SETTLEMENT_ROLE; the single paid example was skipped.');
  }

  console.log('  demo data ready: 1 pending, 2 reserved, 1 rejected, 1 paid');
  printSummary(publicClient, manager);
}

async function printSummary(publicClient, manager) {
  const stats = await publicClient.readContract({
    ...manager,
    functionName: 'getStats',
  });
  console.log(
    `  stats: total=${stats.total} pending=${stats.pending} reserved=${stats.approvedReserved} paid=${stats.paid} rejected=${stats.rejected} cancelled=${stats.cancelled}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const networkIndex = process.argv.indexOf('--network');
  const networkName = networkIndex !== -1 ? process.argv[networkIndex + 1] : 'local';
  const fileIndex = process.argv.indexOf('--deployment');
  const deploymentFile = fileIndex !== -1 ? process.argv[fileIndex + 1] : undefined;
  seedDemo({ networkName, deploymentFile }).catch((error) => {
    console.error(`\nSeed failed: ${error.shortMessage || error.message}`);
    if (error.details) console.error(error.details);
    process.exitCode = 1;
  });
}
