/**
 * Demo-only label maps. The contract stores numeric ids on purpose; these labels are presentation
 * fixtures and are not protocol truth. No personal data belongs in this file.
 */

export const CATEGORY_OPTIONS = [
  { value: 1, label: 'Vehicle finance' },
  { value: 2, label: 'Insurance claim' },
  { value: 3, label: 'Repair' },
  { value: 4, label: 'Total loss' },
  { value: 5, label: 'Medical subrogation' },
  { value: 6, label: 'Property damage' },
  { value: 7, label: 'Liability' },
  { value: 8, label: 'Other' },
] as const;

const CATEGORY_LABELS = new Map<number, string>(
  CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
);

export const BRANCH_OPTIONS = [
  { value: 101, label: 'Jakarta' },
  { value: 102, label: 'Surabaya' },
  { value: 103, label: 'Bandung' },
  { value: 104, label: 'Medan' },
  { value: 105, label: 'Makassar' },
] as const;

const BRANCH_LABELS = new Map<number, string>(
  BRANCH_OPTIONS.map((option) => [option.value, option.label]),
);

export function categoryLabel(categoryId: number | undefined): string {
  if (categoryId === undefined) return '—';
  return CATEGORY_LABELS.get(categoryId) ?? `Category ${categoryId}`;
}

export function branchLabel(branchCode: number | undefined): string {
  if (branchCode === undefined) return '—';
  const label = BRANCH_LABELS.get(branchCode);
  return label ? `${branchCode} · ${label}` : `Branch ${branchCode}`;
}

export function branchShortLabel(branchCode: number | undefined): string {
  if (branchCode === undefined) return '—';
  return BRANCH_LABELS.get(branchCode) ?? String(branchCode);
}

export function isKnownBranch(branchCode: number): boolean {
  return BRANCH_LABELS.has(branchCode);
}
