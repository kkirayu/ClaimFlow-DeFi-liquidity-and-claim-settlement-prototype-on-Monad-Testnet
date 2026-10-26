import { formatUnits, parseUnits } from 'viem';
import { TOKEN_DECIMALS, TOKEN_SYMBOL } from './contracts';

export type ParseResult = { ok: true; value: bigint } | { ok: false; error: string };

function groupWhole(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats a raw 6-decimal token amount for tables. Very small non-zero amounts are shown with
 * token precision instead of silently rounding to 0.00.
 */
export function formatToken(raw: bigint | undefined | null, maxFractionDigits = 2): string {
  if (raw === undefined || raw === null) return '—';
  const negative = raw < 0n;
  const absolute = negative ? -raw : raw;
  const asString = formatUnits(absolute, TOKEN_DECIMALS);
  const [whole = '0', fraction = ''] = asString.split('.');

  let displayedFraction = fraction.slice(0, maxFractionDigits).replace(/0+$/, '');
  const nonZeroButBelowDisplay = absolute > 0n && displayedFraction === '';
  if (nonZeroButBelowDisplay && maxFractionDigits <= 2) {
    displayedFraction = fraction.slice(0, TOKEN_DECIMALS).replace(/0+$/, '');
  }
  const fractionPart = displayedFraction ? `.${displayedFraction}` : '.00';
  return `${negative ? '-' : ''}${groupWhole(whole)}${fractionPart}`;
}

export function formatTokenExact(raw: bigint | undefined | null): string {
  if (raw === undefined || raw === null) return '—';
  const negative = raw < 0n;
  const absolute = negative ? -raw : raw;
  const asString = formatUnits(absolute, TOKEN_DECIMALS);
  const [whole = '0', fraction = ''] = asString.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return `${negative ? '-' : ''}${groupWhole(whole)}${trimmed ? `.${trimmed}` : ''}`;
}

export function formatTokenWithSymbol(raw: bigint | undefined | null, digits = 2): string {
  return `${formatToken(raw, digits)} ${TOKEN_SYMBOL}`;
}

export function parseTokenInput(input: string, maxDecimals = TOKEN_DECIMALS): ParseResult {
  const normalized = input.trim().replace(/,/g, '');
  if (!normalized) return { ok: false, error: 'Enter an amount.' };
  if (normalized.startsWith('-')) return { ok: false, error: 'Amount cannot be negative.' };
  if (!/^\d*\.?\d*$/.test(normalized)) {
    return { ok: false, error: 'Enter a valid number using digits and a decimal point.' };
  }
  const [, fraction = ''] = normalized.split('.');
  if (fraction.length > maxDecimals) {
    return { ok: false, error: `${TOKEN_SYMBOL} supports at most ${maxDecimals} decimal places.` };
  }
  try {
    const value = parseUnits(normalized, maxDecimals);
    if (value <= 0n) return { ok: false, error: 'Enter an amount greater than zero.' };
    return { ok: true, value };
  } catch {
    return { ok: false, error: 'Enter a valid number.' };
  }
}

export function shortAddress(address?: string, visible = 4): string {
  if (!address) return '—';
  if (address.length <= visible * 2 + 2) return address;
  return `${address.slice(0, visible + 2)}…${address.slice(-visible)}`;
}

export function shortHash(hash?: string, visible = 6): string {
  if (!hash) return '—';
  if (hash.length <= visible * 2 + 2) return hash;
  return `${hash.slice(0, visible + 2)}…${hash.slice(-visible)}`;
}

export function formatDateTime(timestampSeconds?: number | bigint | null): string {
  if (timestampSeconds === undefined || timestampSeconds === null) return '—';
  const value = Number(timestampSeconds);
  if (!Number.isFinite(value) || value <= 0) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value * 1000));
}

export function formatDate(timestampSeconds?: number | bigint | null): string {
  if (timestampSeconds === undefined || timestampSeconds === null) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Number(timestampSeconds) * 1000));
}

export function formatRelativeTime(timestampSeconds?: number | bigint | null): string {
  if (timestampSeconds === undefined || timestampSeconds === null) return '—';
  const value = Number(timestampSeconds) * 1000;
  if (!Number.isFinite(value) || value <= 0) return '—';
  const diffSeconds = Math.round((value - Date.now()) / 1000);
  const absolute = Math.abs(diffSeconds);
  if (absolute < 20) return 'just now';
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (absolute < 60) return formatter.format(Math.round(diffSeconds), 'second');
  if (absolute < 3600) return formatter.format(Math.round(diffSeconds / 60), 'minute');
  if (absolute < 86_400) return formatter.format(Math.round(diffSeconds / 3600), 'hour');
  if (absolute < 2_592_000) return formatter.format(Math.round(diffSeconds / 86_400), 'day');
  return formatter.format(Math.round(diffSeconds / 2_592_000), 'month');
}

export function formatPercentBps(bps?: number | bigint | null): string {
  if (bps === undefined || bps === null) return 'N/A';
  const numeric = Number(bps);
  if (!Number.isFinite(numeric)) return 'N/A';
  return `${(numeric / 100).toFixed(numeric % 100 === 0 ? 0 : 2)}%`;
}

export function utilizationPercent(reserved: bigint, balance: bigint): number | null {
  if (balance === 0n) return null;
  return (Number(reserved) / Number(balance)) * 100;
}

export function formatUtilization(reserved: bigint, balance: bigint): string {
  const value = utilizationPercent(reserved, balance);
  if (value === null) return 'N/A';
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function formatInteger(value: number | bigint | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return new Intl.NumberFormat('en-US').format(Number(value));
}

export function formatLatency(ms?: number | null): string {
  if (ms === undefined || ms === null || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatDuration(ms?: number | null): string {
  if (ms === undefined || ms === null || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

export function formatGas(value?: bigint | number | null): string {
  if (value === undefined || value === null) return '—';
  return new Intl.NumberFormat('en-US').format(Number(value));
}

export function formatRate(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(value < 10 ? 2 : 1)} tx/s`;
}

export function formatCountdown(
  targetSeconds?: number | bigint | null,
  nowMs = Date.now(),
): string {
  if (targetSeconds === undefined || targetSeconds === null) return '';
  const remaining = Number(targetSeconds) * 1000 - nowMs;
  if (remaining <= 0) return 'available now';
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `in ${hours}h ${minutes % 60}m`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatInteger(count)} ${count === 1 ? singular : plural}`;
}
