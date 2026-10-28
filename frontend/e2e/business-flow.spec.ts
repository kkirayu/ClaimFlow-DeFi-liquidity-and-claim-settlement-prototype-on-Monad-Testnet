import { randomBytes } from 'node:crypto';
import { parseUnits, type Address, type Hex } from 'viem';
import {
  ACCOUNTS,
  claimIds,
  ensureRoleAccounts,
  ensureVaultLiquidity,
  expect,
  readClaim,
  rpcIsReachable,
  signInAs,
  test,
  tokenBalance,
} from './fixtures';

const CLAIM_AMOUNT = parseUnits('12.5', 6);

function opaqueHash(): Hex {
  return `0x${randomBytes(32).toString('hex')}`;
}

interface ClaimView {
  claimRefHash: Hex;
  recipient: Address;
  amount: bigint;
  status: number;
}

/** viem returns multi-output getters as tuples; normalize both tuple and object shapes. */
async function claimView(claimId: Hex): Promise<ClaimView> {
  const raw = (await readClaim(claimId)) as unknown as Record<string, unknown> | readonly unknown[];
  const isTuple = Array.isArray(raw);
  const field = <T>(key: keyof ClaimView, index: number): T =>
    (isTuple ? (raw as readonly unknown[])[index] : (raw as Record<string, unknown>)[key]) as T;

  return {
    claimRefHash: field<Hex>('claimRefHash', 1),
    recipient: field<Address>('recipient', 4),
    amount: field<bigint>('amount', 5),
    status: Number(field<number>('status', 7)),
  };
}

async function findClaimIdByRef(refHash: Hex): Promise<Hex> {
  for (const id of await claimIds()) {
    const claim = await claimView(id);
    if (claim.claimRefHash.toLowerCase() === refHash.toLowerCase()) return id;
  }
  throw new Error(`No claim found with reference ${refHash}.`);
}

test.describe('role-based business flow', () => {
  test.beforeAll(async () => {
    if (!(await rpcIsReachable())) {
      test.skip(true, 'Anvil RPC is not running; start pnpm dev:local before E2E.');
    }
    await ensureRoleAccounts();
    await ensureVaultLiquidity();
  });

  test('operator submits, approver reserves, settler pays, and accounting stays consistent', async ({
    page,
    wallet,
  }) => {
    const refHash = opaqueHash();
    const recipient = ACCOUNTS.viewer.address;

    // 1. Claim Operator authenticates and submits a claim through the UI.
    await signInAs(page, wallet, 'operator');
    await page.goto('/claims');
    await expect(page.getByRole('heading', { name: 'Claims', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New claim' })).toBeEnabled();

    await page.getByRole('button', { name: 'New claim' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'New claim' })).toBeVisible();
    await dialog.locator('#claim-ref').fill(refHash);
    await dialog.locator('#claim-recipient').fill(recipient);
    await dialog.locator('#claim-amount').fill('12.5');
    await dialog.getByRole('button', { name: 'Submit claim' }).click();

    await expect(page.getByText('Transaction confirmed').first()).toBeVisible({
      timeout: 45_000,
    });
    await expect(dialog).toBeHidden();

    const claimId = await findClaimIdByRef(refHash);
    await expect.poll(async () => (await claimView(claimId)).status).toBe(1);

    // 2. Claim Approver authenticates and reserves liquidity atomically.
    await signInAs(page, wallet, 'approver');
    await page.goto('/claims');
    await page.getByLabel('Search by claim ID or reference hash').fill(refHash);
    const pendingRow = page.locator('table tbody tr').first();
    await expect(pendingRow).toContainText('Pending');
    await pendingRow.getByRole('button', { name: 'Approve and reserve claim' }).click();
    await page.getByRole('button', { name: 'Approve & reserve' }).click();
    await expect(page.getByText('Transaction confirmed').first()).toBeVisible({ timeout: 45_000 });
    await expect.poll(async () => (await claimView(claimId)).status).toBe(2);

    // 3. A wallet with no protocol role can inspect the claim but cannot act on it.
    await signInAs(page, wallet, 'viewer');
    await page.goto(`/claims/${claimId}`);
    await expect(page.getByText('This wallet does not hold a role available')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settle payout' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancel & release reservation' })).toHaveCount(0);

    // 4. Settlement Operator authenticates and pays the approved claim in a batch.
    const recipientBefore = await tokenBalance(recipient);
    await signInAs(page, wallet, 'settler');
    await page.goto('/settlement');
    await expect(page.getByText('Settlement role required')).toHaveCount(0);
    await page.getByLabel('Search approved claims').fill(refHash);
    await page.getByRole('checkbox').first().check();
    await expect(page.getByRole('button', { name: 'Review batch' })).toBeEnabled();
    await page.getByRole('button', { name: 'Review batch' }).click();
    await expect(page.getByRole('dialog').getByText('Confirm batch settlement')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm batch settlement' }).click();
    await expect(page.getByText('Batch confirmed')).toBeVisible({ timeout: 45_000 });

    // 5. The payout and terminal state are verifiable on-chain, not just in the UI.
    await expect.poll(() => tokenBalance(recipient)).toBe(recipientBefore + CLAIM_AMOUNT);
    await expect.poll(async () => (await claimView(claimId)).status).toBe(3);
  });

  test('unauthenticated and roleless wallets fail closed', async ({ page, wallet }) => {
    // No wallet connection: write actions are unavailable.
    await page.goto('/claims');
    await expect(page.getByRole('button', { name: 'New claim' })).toBeDisabled();

    // Connected wallet without a protocol role: read-only with an explicit reason.
    await signInAs(page, wallet, 'viewer');
    await page.goto('/claims');
    await expect(page.getByRole('button', { name: 'New claim' })).toBeDisabled();
    await expect(page.getByText('Operator role required to submit', { exact: true })).toBeVisible();

    await page.goto('/settlement');
    await expect(page.getByText('Settlement role required')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review batch' })).toBeDisabled();

    // The account page reports the verified role state, not a client-side guess.
    await page.goto('/user');
    await expect(page.getByText('Role verified')).toBeVisible();
    await expect(page.getByText('No operational role assigned')).toBeVisible();
  });

  test('wallet authentication survives a reload without losing role access', async ({
    page,
    wallet,
  }) => {
    await signInAs(page, wallet, 'operator');
    await page.goto('/claims');
    await expect(page.getByRole('button', { name: 'New claim' })).toBeEnabled();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('button', { name: new RegExp(ACCOUNTS.operator.address.slice(0, 6), 'i') }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'New claim' })).toBeEnabled();
  });
});
