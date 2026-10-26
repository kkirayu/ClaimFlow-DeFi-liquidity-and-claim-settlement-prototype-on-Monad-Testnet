import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NetworkBadge } from '@/components/wallet/NetworkBadge';
import { WalletButton } from '@/components/wallet/WalletButton';
import { Button } from '@/components/ui/Button';

const TITLES: Array<{ prefix: string; title: string; exact?: boolean }> = [
  { prefix: '/liquidity', title: 'Liquidity' },
  { prefix: '/claims/', title: 'Claim detail' },
  { prefix: '/claims', title: 'Claims' },
  { prefix: '/settlement', title: 'Settlement' },
  { prefix: '/benchmark', title: 'Performance Lab' },
  { prefix: '/protocol', title: 'Protocol' },
];

function pageTitle(pathname: string): string {
  if (pathname === '/') return 'Overview';
  const match = TITLES.find((item) =>
    item.prefix.endsWith('/') ? pathname.startsWith(item.prefix) : pathname === item.prefix,
  );
  return match?.title ?? 'Overview';
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { pathname } = useLocation();
  const title = pageTitle(pathname);

  return (
    <header className="border-border bg-surface/95 sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 h-9 w-9 px-0 lg:hidden"
          onClick={onOpenMenu}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-2 text-[13px]">
            <li className="text-ink-muted hidden sm:block">ClaimFlow</li>
            <li className="text-ink-muted/60 hidden sm:block" aria-hidden="true">
              /
            </li>
            <li className="text-ink-primary truncate font-medium">{title}</li>
          </ol>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <NetworkBadge className="hidden sm:inline-flex" />
        <WalletButton />
      </div>
    </header>
  );
}
