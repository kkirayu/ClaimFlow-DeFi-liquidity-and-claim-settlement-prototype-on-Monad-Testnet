import { expect, rpcIsReachable, test } from './fixtures';

test.describe('wallet and liquidity transaction', () => {
  test.beforeAll(async () => {
    if (!(await rpcIsReachable())) {
      test.skip(true, 'Anvil RPC is not running; start pnpm dev:local before E2E.');
    }
  });

  test('connects an injected wallet and deposits liquidity', async ({ page, wallet }) => {
    void wallet;
    await page.goto('/liquidity');
    await expect(page.getByRole('heading', { name: 'Liquidity', level: 1 })).toBeVisible();
    await expect(page.getByText('Connect a wallet to deposit')).toBeVisible();

    await page.getByRole('button', { name: 'Connect wallet' }).first().click();
    await expect(page.getByRole('button', { name: /0xf39F…2266/ })).toBeVisible();

    const panel = page.locator('div.card').filter({ hasText: 'Deposit liquidity' }).first();
    await expect(panel.getByText('Wallet balance').first()).toBeVisible();
    await panel.locator('#deposit-amount').fill('1');

    const approveButton = panel.getByRole('button', { name: /Approve mUSDC/ });
    if (await approveButton.isVisible()) {
      await approveButton.click();
      await expect(page.getByText('Transaction confirmed').first()).toBeVisible({
        timeout: 45_000,
      });
      await expect(
        panel.getByRole('button', { name: 'Deposit liquidity', exact: true }),
      ).toBeEnabled({
        timeout: 30_000,
      });
    }

    await panel.getByRole('button', { name: 'Deposit liquidity', exact: true }).click();
    await expect(page.getByText(/Deposit 1(\.00)? mUSDC/).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Transaction confirmed').first()).toBeVisible({ timeout: 45_000 });

    await page.goto('/protocol');
    await expect(page.getByText('Claim Operator', { exact: true })).toBeVisible();
    await expect(page.getByText('Granted').first()).toBeVisible();
  });
});
