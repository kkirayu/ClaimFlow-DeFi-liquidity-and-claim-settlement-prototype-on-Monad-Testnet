import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  clearStoredReports,
  fetchCommittedReport,
  loadStoredReports,
  storeReport,
} from '@/lib/benchmark/storage';
import type { BenchmarkReport } from '@/lib/benchmark/types';

export function useBenchmarkReports() {
  const committedQuery = useQuery({
    queryKey: ['benchmark', 'committed'],
    queryFn: fetchCommittedReport,
    staleTime: 60_000,
    retry: false,
  });

  const [reports, setReports] = useState<BenchmarkReport[]>(() => loadStoredReports());

  const save = useCallback((report: BenchmarkReport) => {
    setReports(storeReport(report));
  }, []);

  const clear = useCallback(() => {
    clearStoredReports();
    setReports([]);
  }, []);

  const allReports = useMemo(() => {
    const list = [...reports];
    const committed = committedQuery.data;
    if (committed && !list.some((report) => report.id === committed.id)) list.push(committed);
    return list;
  }, [committedQuery.data, reports]);

  return {
    reports,
    allReports,
    committed: committedQuery.data ?? null,
    committedLoading: committedQuery.isPending,
    latest: reports[0] ?? committedQuery.data ?? null,
    save,
    clear,
  };
}
