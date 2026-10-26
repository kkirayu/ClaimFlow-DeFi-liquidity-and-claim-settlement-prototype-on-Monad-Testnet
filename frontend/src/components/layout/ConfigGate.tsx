import { AlertTriangle, Terminal } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { isConfigured, missingConfig, NETWORK_LABEL } from '@/lib/chain';

export function ConfigGate({ children }: { children: React.ReactNode }) {
  if (isConfigured) return <>{children}</>;

  return (
    <Card>
      <CardHeader
        title="Deployment configuration required"
        description={`No ClaimFlow contract addresses were found for ${NETWORK_LABEL}. The interface reads deployment values from environment variables and never invents addresses.`}
      />
      <CardContent className="space-y-5">
        <div className="rounded-card border-warning-border bg-warning-bg text-ink-secondary flex items-start gap-3 border px-4 py-3 text-[13px] leading-5">
          <AlertTriangle className="text-warning mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-warning font-semibold">Missing configuration</p>
            <ul className="mt-1 list-inside list-disc">
              {missingConfig.map((key) => (
                <li key={key}>
                  <code className="mono">{key}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <p className="text-ink-primary flex items-center gap-2 text-sm font-semibold">
            <Terminal className="text-ink-muted h-4 w-4" aria-hidden="true" />
            Start a local demo
          </p>
          <p className="text-ink-secondary mt-1 text-[13px] leading-5">
            The local command starts Anvil if needed, builds the contracts, deploys and seeds them,
            writes <code className="mono">frontend/.env.local</code>, and launches the app.
          </p>
          <pre className="rounded-card bg-sidebar mt-3 overflow-x-auto px-4 py-3 text-xs leading-6 text-white/85">
            <code>
              pnpm install{'\n'}
              pnpm dev:local
            </code>
          </pre>
        </div>

        <div>
          <p className="text-ink-primary text-sm font-semibold">Or deploy to Monad Testnet</p>
          <p className="text-ink-secondary mt-1 text-[13px] leading-5">
            Copy <code className="mono">.env.example</code> to <code className="mono">.env</code>,
            add a dedicated funded testnet key, then run:
          </p>
          <pre className="rounded-card bg-sidebar mt-3 overflow-x-auto px-4 py-3 text-xs leading-6 text-white/85">
            <code>pnpm deploy:testnet</code>
          </pre>
          <p className="text-ink-muted mt-2 text-xs leading-5">
            Private keys are read from the environment only and are never committed or displayed in
            the UI.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
