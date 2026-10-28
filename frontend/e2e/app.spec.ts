import { expect, rpcIsReachable, test } from './fixtures';

test.describe('read-only product flows', () => {
  test.beforeAll(async () => {
    if (!(await rpcIsReachable())) {
      test.skip(true, 'Anvil RPC is not running; start pnpm dev:local before E2E.');
    }
  });

  test('overview shows separated liquidity metrics and claim counters', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
    await expect(page.getByText('Vault balance', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Available liquidity', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Reserved liquidity', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Pool utilization', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Claim queue')).toBeVisible();
    await expect(page.getByText('Demo environment — test tokens only.')).toBeVisible();
    await expect(page.getByText('Unaudited contracts')).toBeVisible();
  });

  test('claims can be filtered and opened with a decoded timeline', async ({ page }) => {
    await page.goto('/claims');
    await expect(page.getByRole('heading', { name: 'Claims', level: 1 })).toBeVisible();

    await page.getByLabel('Status').selectOption('1');
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
    await expect(rows.first()).toContainText('Pending');
    await expect(page.getByText(/claims? match the current filters/)).toBeVisible();

    await page.locator('table a[href^="/claims/"]').first().click();
    await expect(page.getByRole('heading', { name: 'Claim detail', level: 1 })).toBeVisible();
    await expect(page.getByText('Lifecycle timeline')).toBeVisible();
    await expect(page.getByText('Claim submitted')).toBeVisible();
    await expect(page.getByText('Opaque claim metadata')).toBeVisible();
  });

  test('settlement page lists approved claims and explains atomicity', async ({ page }) => {
    await page.goto('/settlement');
    await expect(page.getByRole('heading', { name: 'Settlement', level: 1 })).toBeVisible();
    await expect(page.getByText('Batch settlement is atomic.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select all' })).toBeVisible();
  });

  test('protocol page exposes network, contracts, and role model', async ({ page }) => {
    await page.goto('/protocol');
    await expect(page.getByRole('heading', { name: 'Protocol', level: 1 })).toBeVisible();
    await expect(page.getByText('Claim manager', { exact: true })).toBeVisible();
    await expect(page.getByText('Access control model')).toBeVisible();
    await expect(page.getByText('Safety invariants')).toBeVisible();
    await expect(page.getByText('Self-approval enabled')).toBeVisible();
  });

  test('unknown routes render the not-found state', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to overview' })).toBeVisible();
  });
});

test.describe('mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('navigation drawer works and the page does not overflow horizontally', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav).toBeVisible();
    await nav.getByRole('link', { name: 'Claims' }).click();
    await expect(page.getByRole('heading', { name: 'Claims', level: 1 })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
