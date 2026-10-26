import { isBenchmarkReport } from './metrics';
import type { BenchmarkReport } from './types';

const STORAGE_KEY = 'claimflow.benchmark.reports.v1';
const MAX_STORED_REPORTS = 10;

export function loadStoredReports(): BenchmarkReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBenchmarkReport).slice(0, MAX_STORED_REPORTS);
  } catch {
    return [];
  }
}

export function storeReport(report: BenchmarkReport): BenchmarkReport[] {
  const existing = loadStoredReports().filter((item) => item.id !== report.id);
  const next = [report, ...existing].slice(0, MAX_STORED_REPORTS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable in private modes; the report is still shown in memory.
  }
  return next;
}

export function clearStoredReports(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

export async function fetchCommittedReport(): Promise<BenchmarkReport | null> {
  try {
    const response = await fetch('/benchmark/latest.json', { cache: 'no-store' });
    if (!response.ok) return null;
    const parsed: unknown = await response.json();
    return isBenchmarkReport(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function latestReport(reports: BenchmarkReport[]): BenchmarkReport | null {
  return reports[0] ?? null;
}
