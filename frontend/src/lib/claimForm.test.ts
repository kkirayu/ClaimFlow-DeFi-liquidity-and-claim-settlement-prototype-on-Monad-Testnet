import { describe, expect, it } from 'vitest';
import {
  emptyClaimForm,
  generateOpaqueHash,
  isBytes32,
  validateClaimForm,
  type ClaimFormValues,
} from './claimForm';

const HASH = `0x${'ab'.repeat(32)}`;
const RECIPIENT = '0x1111111111111111111111111111111111111111';

function values(overrides: Partial<ClaimFormValues> = {}): ClaimFormValues {
  return {
    claimId: `0x${'01'.repeat(32)}`,
    claimRefHash: HASH,
    branchCode: '101',
    categoryId: '2',
    recipient: RECIPIENT,
    amount: '125.5',
    evidenceHash: '',
    ...overrides,
  };
}

describe('isBytes32', () => {
  it('accepts only 0x-prefixed 32-byte hex', () => {
    expect(isBytes32(HASH)).toBe(true);
    expect(isBytes32(HASH.toUpperCase().replace('0X', '0x'))).toBe(true);
    expect(isBytes32('0x1234')).toBe(false);
    expect(isBytes32(HASH.slice(0, -1))).toBe(false);
    expect(isBytes32(`x${HASH.slice(2)}`)).toBe(false);
  });
});

describe('generateOpaqueHash', () => {
  it('produces unique 32-byte hex values', () => {
    const first = generateOpaqueHash();
    const second = generateOpaqueHash();
    expect(isBytes32(first)).toBe(true);
    expect(isBytes32(second)).toBe(true);
    expect(first).not.toBe(second);
  });
});

describe('validateClaimForm', () => {
  it('returns a parsed claim when all fields are valid', () => {
    const result = validateClaimForm(values());
    expect(result.errors).toEqual({});
    expect(result.parsed).toMatchObject({
      branchCode: 101,
      categoryId: 2,
      recipient: RECIPIENT,
      amount: 125_500_000n,
      evidenceHash: `0x${'0'.repeat(64)}`,
    });
  });

  it('requires a valid reference hash, branch, category, recipient, and amount', () => {
    const result = validateClaimForm(
      values({
        claimRefHash: '0x12',
        branchCode: '0',
        categoryId: '9',
        recipient: 'not-an-address',
        amount: '',
      }),
    );
    expect(result.parsed).toBeUndefined();
    expect(result.errors.claimRefHash).toBeTruthy();
    expect(result.errors.branchCode).toBeTruthy();
    expect(result.errors.categoryId).toBeTruthy();
    expect(result.errors.recipient).toBeTruthy();
    expect(result.errors.amount).toBeTruthy();
  });

  it('rejects the zero address and invalid evidence hashes', () => {
    const result = validateClaimForm(
      values({
        recipient: '0x0000000000000000000000000000000000000000',
        evidenceHash: '0xopaque',
      }),
    );
    expect(result.errors.recipient).toContain('zero address');
    expect(result.errors.evidenceHash).toBeTruthy();
  });

  it('accepts a valid evidence hash and rejects fractional branch codes', () => {
    const valid = validateClaimForm(values({ evidenceHash: `0x${'cd'.repeat(32)}` }));
    expect(valid.errors).toEqual({});
    const invalid = validateClaimForm(values({ branchCode: '101.5' }));
    expect(invalid.errors.branchCode).toBeTruthy();
  });

  it('reports a regenerated claim ID when the provided one is malformed', () => {
    const result = validateClaimForm(values({ claimId: '0x1234' }));
    expect(result.parsed).toBeUndefined();
    expect(result.errors.claimRefHash).toContain('Claim ID is invalid');
  });
});

describe('emptyClaimForm', () => {
  it('prefills opaque IDs and safe demo defaults', () => {
    const form = emptyClaimForm();
    expect(isBytes32(form.claimId)).toBe(true);
    expect(isBytes32(form.claimRefHash)).toBe(true);
    expect(form.branchCode).toBe('101');
    expect(form.categoryId).toBe('1');
    expect(form.recipient).toBe('');
    expect(form.amount).toBe('');
  });
});
