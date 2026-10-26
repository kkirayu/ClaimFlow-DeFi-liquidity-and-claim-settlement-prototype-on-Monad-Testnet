import { FlaskConical, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DemoEnvironmentBanner() {
  return (
    <div className="rounded-card border-info-border bg-info-bg text-ink-secondary mb-5 flex flex-col gap-2 border px-4 py-3 text-[13px] leading-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <FlaskConical className="text-info mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <span className="text-info font-semibold">Demo environment — test tokens only.</span>{' '}
          Amounts are mock mUSDC with no monetary value. Never enter personal or policy data.
        </p>
      </div>
      <Link
        to="/protocol"
        className="text-info inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold hover:underline"
      >
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
        Unaudited contracts
      </Link>
    </div>
  );
}
