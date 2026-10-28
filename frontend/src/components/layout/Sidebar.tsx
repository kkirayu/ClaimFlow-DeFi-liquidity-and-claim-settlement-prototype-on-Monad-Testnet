import { NavLink } from 'react-router-dom';
import {
  Activity,
  Blocks,
  ClipboardList,
  Droplets,
  LayoutDashboard,
  Layers3,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { NETWORK_LABEL } from '@/lib/chain';

const NAVIGATION = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/liquidity', label: 'Liquidity', icon: Droplets, end: false },
  { to: '/claims', label: 'Claims', icon: ClipboardList, end: false },
  { to: '/settlement', label: 'Settlement', icon: Send, end: false },
  { to: '/benchmark', label: 'Performance Lab', icon: Activity, end: false },
  { to: '/protocol', label: 'Protocol', icon: Blocks, end: false },
] as const;

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="bg-sidebar flex h-full w-full flex-col text-white">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <div className="bg-primary grid h-9 w-9 place-items-center rounded-[10px] shadow-sm">
          <Layers3 className="h-[18px] w-[18px]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-[-0.01em]">ClaimFlow</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/50">
            Settlement console
          </p>
        </div>
      </div>

      <nav className="scrollbar-subtle flex-1 overflow-y-auto px-3 py-5" aria-label="Primary">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
          Workspace
        </p>
        <ul className="mt-2 space-y-1">
          {NAVIGATION.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-sidebar-hover text-white'
                        : 'hover:bg-sidebar-hover/70 text-white/65 hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'bg-primary absolute inset-y-2 left-0 w-[3px] rounded-r-full transition-opacity',
                          isActive ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden="true"
                      />
                      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      {item.label}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="rounded-card mx-3 mb-3 border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center gap-2">
          <span className="bg-warning h-2 w-2 rounded-full" aria-hidden="true" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/80">
            Demo environment
          </span>
        </div>
        <p className="mt-1.5 text-[11px] leading-4 text-white/55">
          Test tokens only. Contracts are unaudited; never use real funds or personal data.
        </p>
        <p className="mt-2 text-[11px] font-medium text-white/75">{NETWORK_LABEL}</p>
      </div>
      <p className="px-5 pb-4 text-[10px] text-white/35">Hackathon prototype · v1.0</p>
    </aside>
  );
}
