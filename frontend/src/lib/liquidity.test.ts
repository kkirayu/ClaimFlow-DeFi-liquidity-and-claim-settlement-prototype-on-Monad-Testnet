import { describe, expect, it } from 'vitest';
import { previewDepositShares, previewWithdrawAssets, shareOfPoolBps } from './liquidity';

describe('previewDepositShares', () => {
  it('issues one share per asset for the first deposit', () => {
    expect(previewDepositShares(1_000_000n, 0n, 0n)).toBe(1_000_000n);
  });

  it('prices new shares against available liquidity', () => {
    expect(previewDepositShares(1_000_000n, 2_000_000n, 2_000_000n)).toBe(1_000_000n);
    expect(previewDepositShares(500_000n, 2_000_000n, 2_000_000n)).toBe(500_000n);
  });

  it('mirrors the contract guard when liquidity is fully reserved', () => {
    expect(previewDepositShares(500_000n, 1_000_000n, 0n)).toBe(0n);
  });

  it('returns zero for non-positive deposits', () => {
    expect(previewDepositShares(0n, 1_000_000n, 1_000_000n)).toBe(0n);
    expect(previewDepositShares(-1n, 1_000_000n, 1_000_000n)).toBe(0n);
  });
});

describe('previewWithdrawAssets', () => {
  it('never prices shares above available liquidity', () => {
    expect(previewWithdrawAssets(1_000_000n, 2_000_000n, 1_500_000n)).toBe(750_000n);
    expect(previewWithdrawAssets(2_000_000n, 2_000_000n, 1_500_000n)).toBe(1_500_000n);
  });

  it('returns zero for empty or invalid positions', () => {
    expect(previewWithdrawAssets(0n, 2_000_000n, 1_000_000n)).toBe(0n);
    expect(previewWithdrawAssets(1n, 0n, 1_000_000n)).toBe(0n);
    expect(previewWithdrawAssets(1n, 2n, 0n)).toBe(0n);
  });
});

describe('shareOfPoolBps', () => {
  it('computes basis points of the share supply', () => {
    expect(shareOfPoolBps(1_000_000n, 4_000_000n)).toBe(2_500);
    expect(shareOfPoolBps(0n, 4_000_000n)).toBe(0);
  });

  it('returns null when no shares exist', () => {
    expect(shareOfPoolBps(0n, 0n)).toBeNull();
  });
});
