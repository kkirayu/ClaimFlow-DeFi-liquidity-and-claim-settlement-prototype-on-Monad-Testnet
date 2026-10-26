import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { DemoEnvironmentBanner } from './DemoEnvironmentBanner';
import { NetworkGuard } from './NetworkGuard';
import { ConfigGate } from './ConfigGate';

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="bg-canvas min-h-screen">
      <a
        href="#main-content"
        className="focus:rounded-field focus:bg-primary sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <div className="fixed inset-y-0 left-0 z-40 hidden w-[248px] lg:block">
        <Sidebar />
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#101828]/60"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          />
          <div className="animate-slide-in shadow-pop relative z-10 h-full w-[280px]">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[248px]">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <main id="main-content" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <DemoEnvironmentBanner />
          <NetworkGuard />
          <ConfigGate>
            <Outlet />
          </ConfigGate>
          <footer className="border-border text-ink-muted mt-8 border-t pt-4 text-[11px] leading-5">
            ClaimFlow prototype · Mock assets only · Contracts are not audited for production.
          </footer>
        </main>
      </div>
    </div>
  );
}
