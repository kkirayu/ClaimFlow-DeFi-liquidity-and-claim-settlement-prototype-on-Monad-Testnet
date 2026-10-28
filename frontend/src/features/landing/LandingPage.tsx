import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Droplets,
  FileCheck2,
  Gauge,
  Layers3,
  ShieldCheck,
  Target,
  TrendingDown,
  Users,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { WalletButton } from '@/components/wallet/WalletButton';
import { buttonStyles } from '@/components/ui/Button';
import { HeroCarousel } from './HeroCarousel';

const FEATURES = [
  {
    icon: Droplets,
    title: 'Capital that stays useful',
    description:
      'Provide liquidity to a shared vault while ClaimFlow keeps available and reserved funds distinct.',
  },
  {
    icon: Zap,
    title: 'Fast, clear settlement',
    description:
      'Move a claim from review to payment with a transparent, auditable workflow on Monad.',
  },
  {
    icon: ShieldCheck,
    title: 'Built for control',
    description:
      'Role-aware actions and onchain accounting give every team member a focused workspace.',
  },
] as const;

const ABOUT_PRINCIPLES = [
  {
    icon: Layers3,
    title: 'One ledger for money and claims',
    description:
      'Vault liquidity and claim obligations live in the same accounting model, so reserved funds are never mixed with spendable capital.',
  },
  {
    icon: FileCheck2,
    title: 'Evidence stays verifiable',
    description:
      'Every claim carries an onchain reference and evidence hash, giving reviewers a single source of truth instead of scattered files.',
  },
  {
    icon: Users,
    title: 'Roles match responsibilities',
    description:
      'Operators, approvers, settlers, and admins each see the actions they own — nothing more, nothing less.',
  },
] as const;

const BUSINESS_GAINS = [
  {
    icon: TrendingDown,
    metric: 'Less idle capital',
    before: 'Funds parked for worst-case payouts',
    after: 'Liquidity reserved only when a claim is approved',
  },
  {
    icon: Clock3,
    metric: 'Faster settlement cycles',
    before: 'Handoffs across spreadsheets and chats',
    after: 'One queue from submission to payout',
  },
  {
    icon: Target,
    metric: 'Cleaner reconciliation',
    before: 'Manual matching of transfers to claims',
    after: 'Every payout tied to a claim record',
  },
] as const;

const PROTOCOL_FACTS = [
  { label: 'Network', value: 'Monad Testnet' },
  { label: 'Liquidity', value: 'Shared vault, share-based' },
  { label: 'Claim lifecycle', value: 'Pending → Approved → Paid' },
  { label: 'Access', value: 'Operator · Approver · Settler · Admin' },
] as const;

export function LandingPage() {
  return (
    <div className="bg-canvas text-ink-primary min-h-screen overflow-hidden">
      <header className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="ClaimFlow home">
          <span className="bg-primary grid h-10 w-10 place-items-center rounded-xl text-white shadow-sm">
            <Layers3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-base font-semibold tracking-tight">ClaimFlow</span>
            <span className="text-ink-muted hidden whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] sm:block">
              Settlement protocol
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <nav aria-label="Landing sections" className="mr-2 hidden items-center gap-6 md:flex">
            <a
              href="#about"
              className="text-ink-secondary hover:text-primary text-sm font-medium transition-colors"
            >
              About
            </a>
            <a
              href="#business"
              className="text-ink-secondary hover:text-primary text-sm font-medium transition-colors"
            >
              Why ClaimFlow
            </a>
          </nav>
          <Link
            to="/dashboard"
            className={buttonStyles({
              variant: 'ghost',
              size: 'sm',
              className: 'hidden sm:inline-flex',
            })}
          >
            Open app
          </Link>
          <WalletButton />
        </div>
      </header>

      <main>
        <HeroCarousel />

        <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-20">
          <div className="grid gap-4 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <article key={title} className="card p-6">
                <span className="bg-primary-soft text-primary grid h-10 w-10 place-items-center rounded-lg">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-base font-semibold">{title}</h2>
                <p className="text-ink-secondary mt-2 text-sm leading-6">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="border-border bg-surface scroll-mt-20 border-y">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
              <div>
                <p className="text-primary text-xs font-semibold uppercase tracking-[0.12em]">
                  About ClaimFlow
                </p>
                <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl sm:leading-[1.15]">
                  A settlement layer built around the people who operate it.
                </h2>
                <div className="text-ink-secondary mt-6 max-w-2xl space-y-4 text-base leading-7">
                  <p>
                    Claims operations usually grow across spreadsheets, shared inboxes, and a wallet
                    only one person understands. Capital sits idle for payouts that may never
                    happen, and every reconciliation turns into a hunt for context.
                  </p>
                  <p>
                    ClaimFlow brings liquidity and the claim lifecycle into one workspace: fund a
                    shared vault, review a claim with its evidence attached, and release payment
                    with the accounting already in place.
                  </p>
                  <p className="text-ink-muted text-sm">
                    This build is a prototype on Monad Testnet. It uses mock assets and unaudited
                    contracts, and is meant to demonstrate the operating model rather than handle
                    real funds.
                  </p>
                </div>

                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  {ABOUT_PRINCIPLES.map(({ icon: Icon, title, description }) => (
                    <article key={title}>
                      <span className="bg-primary-soft text-primary grid h-9 w-9 place-items-center rounded-lg">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                      <p className="text-ink-secondary mt-1.5 text-[13px] leading-6">
                        {description}
                      </p>
                    </article>
                  ))}
                </div>
              </div>

              <aside className="bg-canvas rounded-card border-border border p-6 sm:p-7">
                <div className="flex items-center gap-2">
                  <Gauge className="text-primary h-4 w-4" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">Protocol at a glance</h3>
                </div>
                <dl className="mt-5 space-y-4">
                  {PROTOCOL_FACTS.map((fact) => (
                    <div key={fact.label}>
                      <dt className="text-ink-muted text-[11px] font-semibold uppercase tracking-[0.08em]">
                        {fact.label}
                      </dt>
                      <dd className="text-ink-primary mt-1 text-sm font-medium">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="border-border mt-6 border-t pt-5">
                  <div className="bg-warning-bg text-warning flex items-start gap-2 rounded-lg p-3 text-[12px] leading-5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    Demo environment. Use test tokens only; never send real funds or personal data.
                  </div>
                </div>
                <Link
                  to="/protocol"
                  className={buttonStyles({
                    variant: 'outline',
                    size: 'sm',
                    className: 'mt-5 w-full',
                  })}
                >
                  Read the protocol details
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </aside>
            </div>
          </div>
        </section>

        <section id="business" className="scroll-mt-20">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="max-w-3xl">
              <p className="text-primary text-xs font-semibold uppercase tracking-[0.12em]">
                Business impact
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl sm:leading-[1.15]">
                A leaner operation, from first review to final payout.
              </h2>
              <p className="text-ink-secondary mt-5 text-base leading-7 sm:text-lg">
                ClaimFlow is designed to remove the hidden cost of every claim — the idle capital,
                the manual handoffs, and the reconciliation that happens after the money has already
                moved.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {BUSINESS_GAINS.map(({ icon: Icon, metric, before, after }) => (
                <article key={metric} className="card p-6">
                  <span className="bg-success-bg text-success grid h-10 w-10 place-items-center rounded-lg">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold">{metric}</h3>
                  <div className="mt-4 space-y-3 text-[13px] leading-6">
                    <p className="text-ink-muted">
                      <span className="bg-surface-muted text-ink-muted mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]">
                        Before
                      </span>
                      {before}
                    </p>
                    <p className="text-ink-primary">
                      <span className="bg-success-bg text-success mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]">
                        With ClaimFlow
                      </span>
                      {after}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <div className="rounded-card bg-sidebar relative mt-10 overflow-hidden p-8 text-white sm:p-10">
              <div
                className="bg-primary/25 pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
                aria-hidden="true"
              />
              <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div>
                  <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                    <Zap className="text-warning h-3.5 w-3.5" aria-hidden="true" />
                    The bottom line
                  </p>
                  <h3 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
                    Stop reconciling claims. Start settling them.
                  </h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
                    Connect a wallet, add test liquidity, and run a claim end to end. The whole loop
                    takes minutes, not a quarter.
                  </p>
                  <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/75">
                    {[
                      'No spreadsheets',
                      'Reserved funds always visible',
                      'Auditable payout trail',
                    ].map((item) => (
                      <li key={item} className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="text-success h-3.5 w-3.5" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <Link to="/dashboard" className={buttonStyles({ size: 'md', className: 'px-5' })}>
                    Enter workspace
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    to="/user"
                    className={buttonStyles({
                      variant: 'outline',
                      size: 'md',
                      className:
                        'border-white/20 bg-transparent px-5 text-white hover:border-white/40 hover:bg-white/10 hover:text-white',
                    })}
                  >
                    View your account
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-border bg-surface border-y">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-primary text-xs font-semibold uppercase tracking-[0.12em]">
                One operational flow
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Fund the vault. Review the claim. Release the payment.
              </h2>
            </div>
            <Link to="/dashboard" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
              Explore the dashboard
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="text-ink-muted mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>ClaimFlow · Monad Testnet prototype</span>
        <span>Mock assets only. Contracts are not audited for production.</span>
      </footer>
    </div>
  );
}
