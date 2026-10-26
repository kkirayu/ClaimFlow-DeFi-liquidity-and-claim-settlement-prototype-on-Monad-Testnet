import { describe, expect, it } from 'vitest';
import {
  formatCountdown,
  formatInteger,
  formatPercentBps,
  formatToken,
  formatTokenExact,
  formatTokenWithSymbol,
  formatUtilization,
  parseTokenInput,
  shortAddress,
  shortHash,
  utilizationPercent,
} from './format';

describe('formatToken', () => {
  it('formats six-decimal token amounts with grouping and two decimals', () => {
    expect(formatToken(1_000_000n)).toBe('1.00');
    expect(formatToken(123_456_789n)).toBe('123.45');
    expect(formatToken(1_234_567_890_000n)).toBe('1,234,567.89');
  });

  it('preserves very small non-zero amounts instead of rounding them to zero', () => {
    expect(formatToken(1_234n)).toBe('0.001234');
    expect(formatToken(1n)).toBe('0.000001');
  });

  it('handles zero, negatives, and missing values', () => {
    expect(formatToken(0n)).toBe('0.00');
    expect(formatToken(-1_500_000n)).toBe('-1.5');
    expect(formatToken(undefined)).toBe('—');
    expect(formatTokenWithSymbol(2_500_000n)).toBe('2.5 mUSDC');
  });

  it('formats exact values without trailing zeroes', () => {
    expect(formatTokenExact(123_456_789n)).toBe('123.456789');
    expect(formatTokenExact(1_000_000n)).toBe('1');
    expect(formatTokenExact(null)).toBe('—');
  });
});

describe('parseTokenInput', () => {
  it('parses valid inputs including grouped digits', () => {
    expect(parseTokenInput('1.5')).toEqual({ ok: true, value: 1_500_000n });
    expect(parseTokenInput('1,000.25')).toEqual({ ok: true, value: 1_000_250_000n });
    expect(parseTokenInput(' 0.000001 ')).toEqual({ ok: true, value: 1n });
  });

  it('rejects empty, zero, negative, malformed, and over-precise inputs', () => {
    for (const input of ['', '0', '0.0', '-1', 'abc', '1.2.3']) {
      const result = parseTokenInput(input);
      expect(result.ok).toBe(false);
    }
    const overPrecise = parseTokenInput('1.0000001');
    expect(overPrecise.ok).toBe(false);
    if (!overPrecise.ok) expect(overPrecise.error).toContain('at most 6 decimal places');
  });
});

describe('display helpers', () => {
  it('shortens addresses and hashes without cutting tiny values', () => {
    expect(shortAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234…5678');
    expect(shortAddress('0x1234', 4)).toBe('0x1234');
    expect(shortHash('0xabcdef')).toBe('0xabcdef');
    expect(shortAddress(undefined)).toBe('—');
  });

  it('formats utilization and basis points safely', () => {
    expect(formatUtilization(0n, 0n)).toBe('N/A');
    expect(formatUtilization(25n, 100n)).toBe('25%');
    expect(formatUtilization(1n, 3n)).toBe('33.3%');
    expect(utilizationPercent(1n, 0n)).toBeNull();
    expect(formatPercentBps(1250)).toBe('12.50%');
    expect(formatPercentBps(undefined)).toBe('N/A');
  });

  it('formats integer counts and countdowns', () => {
    expect(formatInteger(12345)).toBe('12,345');
    expect(formatInteger(undefined)).toBe('—');
    expect(formatCountdown(1_000, 900_000)).toBe('in 2m');
    expect(formatCountdown(100, 200_000)).toBe('available now');
  });
});
