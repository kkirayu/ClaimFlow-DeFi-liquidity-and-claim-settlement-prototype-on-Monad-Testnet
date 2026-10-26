import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BenchmarkReport } from '@/lib/benchmark/types';
import { OPERATION_LABELS } from '@/lib/benchmark/types';
import { formatLatency } from '@/lib/format';

export function LatencyChart({ report }: { report: BenchmarkReport }) {
  const data = report.samples
    .filter((sample) => sample.status === 'success' && sample.latencyMs !== undefined)
    .map((sample) => ({
      index: sample.index + 1,
      latency: Math.round(sample.latencyMs ?? 0),
      label: sample.label,
    }));

  if (data.length === 0) {
    return (
      <p className="rounded-card border-border bg-surface-muted/30 text-ink-muted border border-dashed px-4 py-8 text-center text-[13px]">
        No confirmed samples to chart.
      </p>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#E4E7EC" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="index"
            tick={{ fontSize: 11, fill: '#667085' }}
            tickLine={false}
            axisLine={{ stroke: '#E4E7EC' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#667085' }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value: number) => `${Math.round(value)}`}
          />
          <Tooltip
            cursor={{ fill: 'rgba(70, 95, 255, 0.06)' }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #E4E7EC',
              fontSize: 12,
              boxShadow: '0 8px 20px -8px rgba(16,24,40,0.2)',
            }}
            formatter={(value) => [`${Math.round(Number(value))} ms`, 'Receipt latency']}
            labelFormatter={(label) => `Sample ${String(label)}`}
          />
          <Bar
            dataKey="latency"
            name="Receipt latency"
            fill="#465FFF"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-ink-muted mt-1 text-[11px] leading-4">
        Each bar is one measured sample. Latency is wallet submission through confirmed receipt; it
        includes client, RPC, and wallet overhead.
      </p>
    </div>
  );
}

export function ComparisonChart({ reports }: { reports: BenchmarkReport[] }) {
  const latestByOperation = new Map<string, BenchmarkReport>();
  for (const report of reports) {
    if (!latestByOperation.has(report.operation)) latestByOperation.set(report.operation, report);
  }

  const data = [...latestByOperation.values()]
    .filter((report) => report.summary.medianLatencyMs !== null)
    .map((report) => ({
      operation: OPERATION_LABELS[report.operation],
      latency: Math.round(report.summary.medianLatencyMs ?? 0),
    }));

  if (data.length === 0) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#E4E7EC" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="operation"
            tick={{ fontSize: 10, fill: '#667085' }}
            tickLine={false}
            axisLine={{ stroke: '#E4E7EC' }}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#667085' }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value: number) => `${Math.round(value)}`}
          />
          <Tooltip
            cursor={{ fill: 'rgba(6, 118, 71, 0.06)' }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #E4E7EC',
              fontSize: 12,
            }}
            formatter={(value) => [formatLatency(Number(value)), 'Median latency']}
          />
          <Bar
            dataKey="latency"
            name="Median latency"
            fill="#067647"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-ink-muted mt-1 text-[11px] leading-4">
        Latest run per operation in this browser or the committed reference report. Different
        workload sizes and signers make cross-operation numbers directional, not a benchmark of
        network capacity.
      </p>
    </div>
  );
}
