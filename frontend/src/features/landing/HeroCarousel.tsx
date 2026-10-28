import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gauge,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonStyles } from '@/components/ui/Button';

const AUTOPLAY_MS = 6500;

type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  visual: () => JSX.Element;
};

function VaultVisual() {
  return (
    <div className="space-y-3">
      <div className="rounded-card border-border bg-surface shadow-card border p-4">
        <div className="flex items-center justify-between">
          <span className="text-ink-muted text-[10px] font-semibold uppercase tracking-[0.1em]">
            Vault balance
          </span>
          <span className="bg-success-bg text-success rounded-badge px-2 py-0.5 text-[10px] font-semibold">
            Live
          </span>
        </div>
        <p className="tabular text-ink-primary mt-2 text-2xl font-semibold">1,240,000 mUSDC</p>
        <div className="bg-surface-muted mt-3 h-2 overflow-hidden rounded-full">
          <div className="bg-primary h-full w-[72%] rounded-full" />
        </div>
        <div className="text-ink-muted mt-2 flex justify-between text-[11px]">
          <span>Reserved 28%</span>
          <span>Available 72%</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border-border bg-surface border p-4">
          <Wallet className="text-primary h-4 w-4" aria-hidden="true" />
          <p className="text-ink-muted mt-2 text-[11px]">Available</p>
          <p className="tabular mt-0.5 text-sm font-semibold">892,800</p>
        </div>
        <div className="rounded-card border-border bg-surface border p-4">
          <LockKeyhole className="text-warning h-4 w-4" aria-hidden="true" />
          <p className="text-ink-muted mt-2 text-[11px]">Reserved</p>
          <p className="tabular mt-0.5 text-sm font-semibold">347,200</p>
        </div>
      </div>
    </div>
  );
}

function FlowVisual() {
  const steps = [
    { label: 'Claim submitted', meta: 'Evidence hash stored', done: true },
    { label: 'Approver review', meta: 'Funds reserved', done: true },
    { label: 'Settlement', meta: 'Paid to recipient', done: false },
  ];

  return (
    <div className="rounded-card border-border bg-surface shadow-card border p-4">
      <div className="flex items-center justify-between">
        <span className="text-ink-muted text-[10px] font-semibold uppercase tracking-[0.1em]">
          Claim #1042
        </span>
        <span className="bg-warning-bg text-warning rounded-badge px-2 py-0.5 text-[10px] font-semibold">
          In review
        </span>
      </div>
      <ol className="mt-4 space-y-0">
        {steps.map((step, index) => (
          <li key={step.label} className="relative flex gap-3 pb-4 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                className="bg-border absolute left-[9px] top-5 h-full w-px"
                aria-hidden="true"
              />
            ) : null}
            <span
              className={
                step.done
                  ? 'bg-success relative mt-0.5 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full text-white'
                  : 'border-border-strong bg-surface relative mt-0.5 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full border'
              }
            >
              {step.done ? (
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Clock3 className="text-ink-muted h-3 w-3" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className="text-ink-primary block text-[13px] font-medium">{step.label}</span>
              <span className="text-ink-muted block text-[11px]">{step.meta}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SpeedVisual() {
  return (
    <div className="space-y-3">
      <div className="rounded-card border-border bg-surface shadow-card border p-4">
        <div className="flex items-center justify-between">
          <span className="text-ink-muted text-[10px] font-semibold uppercase tracking-[0.1em]">
            Network
          </span>
          <span className="text-primary inline-flex items-center gap-1 text-[10px] font-semibold">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Monad Testnet
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { label: 'Block time', value: '0.4s' },
            { label: 'Finality', value: '0.8s' },
            { label: 'Throughput', value: '10k tps' },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-ink-muted text-[10px]">{item.label}</p>
              <p className="tabular text-ink-primary mt-0.5 text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-card border-border bg-surface border p-4">
        <div className="flex items-center gap-2">
          <Gauge className="text-success h-4 w-4" aria-hidden="true" />
          <span className="text-[13px] font-medium">Settlement latency</span>
        </div>
        <div className="mt-3 flex h-16 items-end gap-1.5" aria-hidden="true">
          {[38, 52, 45, 64, 58, 72, 66, 80, 74, 88, 82, 94].map((height, index) => (
            <span
              key={index}
              className="bg-primary/70 flex-1 rounded-t-[3px]"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    id: 'liquidity',
    eyebrow: 'Built for Monad Testnet',
    title: 'Claims settlement, without the liquidity blind spots.',
    description:
      'ClaimFlow gives operations teams one dependable place to fund, approve, and settle claims with live onchain accounting.',
    highlights: ['Shared liquidity vault', 'Role-based operations', 'Live protocol activity'],
    visual: VaultVisual,
  },
  {
    id: 'workflow',
    eyebrow: 'One operational flow',
    title: 'Every claim in a single, auditable pipeline.',
    description:
      'Track submissions, approvals, and payouts without stitching together spreadsheets or separate tools.',
    highlights: ['Evidence onchain', 'Reserved funds tracked', 'Full status history'],
    visual: FlowVisual,
  },
  {
    id: 'performance',
    eyebrow: 'Fast by design',
    title: 'Settlement speed your team can plan around.',
    description:
      'Monad keeps confirmations quick, so claims move from review to payment while the context is still fresh.',
    highlights: ['Sub-second finality', 'Live metrics', 'Built-in benchmark lab'],
    visual: SpeedVisual,
  },
];

export function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((index: number) => {
    setActive((index + SLIDES.length) % SLIDES.length);
  }, []);

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const previous = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setActive((index) => (index + 1) % SLIDES.length);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  const slide = SLIDES[active] ?? SLIDES[0]!;
  const Visual = slide.visual;

  return (
    <section
      ref={regionRef}
      aria-roledescription="carousel"
      aria-label="ClaimFlow highlights"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          previous();
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          next();
        }
      }}
    >
      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
        <div
          className="bg-primary/10 pointer-events-none absolute -right-40 -top-10 h-96 w-96 rounded-full blur-3xl"
          aria-hidden="true"
        />
        <div
          className="bg-success/10 pointer-events-none absolute -left-40 bottom-0 h-80 w-80 rounded-full blur-3xl"
          aria-hidden="true"
        />

        <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
          <div aria-live="polite" aria-atomic="true">
            <div className="animate-fade-in" key={slide.id}>
              <div className="border-primary/20 bg-primary-soft text-primary rounded-badge inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-semibold">
                <span className="bg-primary h-1.5 w-1.5 rounded-full" aria-hidden="true" />
                {slide.eyebrow}
              </div>
              <h1 className="text-ink-primary mt-6 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl sm:leading-[1.08] xl:text-[3.4rem]">
                {slide.title}
              </h1>
              <p className="text-ink-secondary mt-5 max-w-2xl text-lg leading-8 sm:text-xl">
                {slide.description}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/dashboard" className={buttonStyles({ size: 'md', className: 'px-5' })}>
                  Enter workspace
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/user"
                  className={buttonStyles({ variant: 'outline', size: 'md', className: 'px-5' })}
                >
                  View your account
                </Link>
              </div>
              <ul className="text-ink-secondary mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {slide.highlights.map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="text-success h-4 w-4" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="relative">
            <div className="bg-surface/70 rounded-card border-border/70 shadow-pop border p-3 backdrop-blur sm:p-4">
              <div className="animate-fade-in" key={`${slide.id}-visual`}>
                <Visual />
              </div>
            </div>
            <span className="text-ink-muted absolute -bottom-7 right-1 inline-flex items-center gap-1 text-[11px] font-medium">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Prototype data for demonstration
            </span>
          </div>
        </div>

        <div className="relative mt-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2" role="tablist" aria-label="Choose a highlight">
            {SLIDES.map((item, index) => {
              const isActive = index === active;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Show slide ${index + 1}: ${item.eyebrow}`}
                  onClick={() => goTo(index)}
                  className={
                    isActive
                      ? 'bg-primary h-2 w-8 rounded-full transition-all'
                      : 'bg-border-strong hover:bg-ink-muted h-2 w-2 rounded-full transition-all'
                  }
                />
              );
            })}
            <span className="text-ink-muted tabular ml-2 text-[11px] font-medium">
              {String(active + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={previous}
              aria-label="Previous slide"
              className="rounded-field border-border-strong bg-surface text-ink-secondary hover:border-primary/40 hover:text-primary inline-flex h-9 w-9 items-center justify-center border transition-colors"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next slide"
              className="rounded-field border-border-strong bg-surface text-ink-secondary hover:border-primary/40 hover:text-primary inline-flex h-9 w-9 items-center justify-center border transition-colors"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          Slide {active + 1} of {SLIDES.length}: {slide.title}
        </p>

        <div className="mt-6 hidden sm:block">
          <Link
            to="/protocol"
            className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline"
          >
            Read how the protocol works
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
