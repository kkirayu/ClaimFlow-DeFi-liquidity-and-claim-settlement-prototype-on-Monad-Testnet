/** Pure share-pricing helpers mirroring LiquidityVault's available-liquidity accounting. */

export function previewDepositShares(
  assets: bigint,
  totalShares: bigint,
  available: bigint,
): bigint {
  if (assets <= 0n) return 0n;
  if (totalShares === 0n) return assets;
  if (available === 0n) return 0n;
  return (assets * totalShares) / available;
}

export function previewWithdrawAssets(
  shares: bigint,
  totalShares: bigint,
  available: bigint,
): bigint {
  if (shares <= 0n || totalShares === 0n || available === 0n) return 0n;
  return (shares * available) / totalShares;
}

export function shareOfPoolBps(shares: bigint, totalShares: bigint): number | null {
  if (totalShares === 0n) return null;
  return Number((shares * 10_000n) / totalShares);
}
