import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { TxLink } from '@/components/data-display/AddressText';
import { formatGas, formatLatency } from '@/lib/format';
import type { BenchmarkSample, BenchmarkSampleStatus } from '@/lib/benchmark/types';

const STATUS_TONE: Record<BenchmarkSampleStatus, BadgeTone> = {
  success: 'success',
  reverted: 'danger',
  error: 'danger',
  skipped: 'neutral',
};

export function SampleTable({ samples }: { samples: BenchmarkSample[] }) {
  if (samples.length === 0) {
    return (
      <p className="rounded-card border-border bg-surface-muted/30 text-ink-muted border border-dashed px-4 py-6 text-center text-[13px]">
        No samples recorded yet.
      </p>
    );
  }

  return (
    <div className="scrollbar-subtle rounded-card border-border max-h-[360px] overflow-auto border">
      <table className="w-full min-w-[720px] border-collapse">
        <thead className="table-head sticky top-0 z-10">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">#</th>
            <th className="px-3 py-2 text-left font-semibold">Sample</th>
            <th className="px-3 py-2 text-left font-semibold">Status</th>
            <th className="px-3 py-2 text-right font-semibold">Latency</th>
            <th className="px-3 py-2 text-right font-semibold">Gas</th>
            <th className="px-3 py-2 text-left font-semibold">Transaction</th>
            <th className="px-3 py-2 text-left font-semibold">Error</th>
          </tr>
        </thead>
        <tbody>
          {samples.map((sample) => (
            <tr key={sample.index} className="border-border border-t">
              <td className="text-ink-muted px-3 py-2 text-[12px]">{sample.index + 1}</td>
              <td className="text-ink-secondary px-3 py-2 text-[12px]">{sample.label}</td>
              <td className="px-3 py-2">
                <Badge tone={STATUS_TONE[sample.status]}>{sample.status}</Badge>
              </td>
              <td className="tabular text-ink-primary px-3 py-2 text-right text-[12px]">
                {formatLatency(sample.latencyMs)}
              </td>
              <td className="tabular text-ink-secondary px-3 py-2 text-right text-[12px]">
                {formatGas(sample.gasUsed)}
              </td>
              <td className="px-3 py-2 text-[12px]">
                <TxLink hash={sample.txHash} />
              </td>
              <td
                className="text-danger max-w-[180px] truncate px-3 py-2 text-[11px]"
                title={sample.error}
              >
                {sample.error ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
