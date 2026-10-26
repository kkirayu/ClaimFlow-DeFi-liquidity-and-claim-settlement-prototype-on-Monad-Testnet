import { isAddress, type Address, type Hex } from 'viem';
import { parseTokenInput, type ParseResult } from './format';
import { ZERO_ADDRESS } from './contracts';

export const MAX_CATEGORY_ID = 8;

export interface ClaimFormValues {
  claimId: string;
  claimRefHash: string;
  branchCode: string;
  categoryId: string;
  recipient: string;
  amount: string;
  evidenceHash: string;
}

export interface ClaimFormErrors {
  claimRefHash?: string;
  branchCode?: string;
  categoryId?: string;
  recipient?: string;
  amount?: string;
  evidenceHash?: string;
}

export interface ParsedClaim {
  claimId: Hex;
  claimRefHash: Hex;
  branchCode: number;
  categoryId: number;
  recipient: Address;
  amount: bigint;
  evidenceHash: Hex;
}

const BYTES32 = /^0x[a-fA-F0-9]{64}$/;

export function isBytes32(value: string): value is Hex {
  return BYTES32.test(value.trim());
}

/** Generates a cryptographically random opaque 32-byte reference. Avoids guessable PII hashes. */
export function generateOpaqueHash(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

export function validateClaimForm(values: ClaimFormValues): {
  errors: ClaimFormErrors;
  parsed?: ParsedClaim;
} {
  const errors: ClaimFormErrors = {};

  if (!isBytes32(values.claimRefHash)) {
    errors.claimRefHash = 'Enter a 32-byte hex reference hash (0x followed by 64 hex characters).';
  }

  const branch = Number(values.branchCode);
  if (
    !values.branchCode.trim() ||
    !Number.isInteger(branch) ||
    branch < 1 ||
    branch > 4_294_967_295
  ) {
    errors.branchCode = 'Enter a positive numeric branch code.';
  }

  const category = Number(values.categoryId);
  if (!Number.isInteger(category) || category < 1 || category > MAX_CATEGORY_ID) {
    errors.categoryId = 'Select a category.';
  }

  if (!values.recipient.trim() || !isAddress(values.recipient.trim())) {
    errors.recipient = 'Enter a valid EVM wallet address.';
  } else if (values.recipient.trim().toLowerCase() === ZERO_ADDRESS) {
    errors.recipient = 'Recipient cannot be the zero address.';
  }

  let amountResult: ParseResult = { ok: false, error: 'Enter an amount.' };
  if (values.amount.trim()) {
    amountResult = parseTokenInput(values.amount);
  }
  if (!amountResult.ok) errors.amount = amountResult.error;

  const evidence = values.evidenceHash.trim();
  if (evidence && !isBytes32(evidence)) {
    errors.evidenceHash =
      'Evidence hash must be 32-byte hex (0x followed by 64 hex characters) or empty.';
  }

  if (!isBytes32(values.claimId)) {
    errors.claimRefHash = errors.claimRefHash ?? 'Claim ID is invalid. Regenerate it and retry.';
  }

  if (Object.keys(errors).length > 0 || !amountResult.ok) {
    return { errors };
  }

  return {
    errors,
    parsed: {
      claimId: values.claimId.trim() as Hex,
      claimRefHash: values.claimRefHash.trim() as Hex,
      branchCode: branch,
      categoryId: category,
      recipient: values.recipient.trim() as Address,
      amount: amountResult.value,
      evidenceHash: evidence ? (evidence as Hex) : (`0x${'0'.repeat(64)}` as Hex),
    },
  };
}

export function emptyClaimForm(): ClaimFormValues {
  return {
    claimId: generateOpaqueHash(),
    claimRefHash: generateOpaqueHash(),
    branchCode: '101',
    categoryId: '1',
    recipient: '',
    amount: '',
    evidenceHash: '',
  };
}
