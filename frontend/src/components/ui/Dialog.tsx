import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/cn';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  preventClose?: boolean;
  labelledBy?: string;
}

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  preventClose = false,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(focusableSelector);
      (focusable ?? panelRef.current)?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !preventClose) {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((node) => node.offsetParent !== null);
      if (nodes.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus();
    };
  }, [open, preventClose, onClose]);

  if (!open) return null;

  const widths = {
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="animate-fade-in absolute inset-0 h-full w-full cursor-default bg-[#101828]/55 backdrop-blur-[1px]"
        aria-label="Close dialog"
        onClick={() => {
          if (!preventClose) onClose();
        }}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        className={cn(
          'border-border bg-surface shadow-pop animate-slide-in sm:rounded-card relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border',
          widths[size],
        )}
      >
        <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
          <div>
            <h2 id="dialog-title" className="text-ink-primary text-lg font-semibold">
              {title}
            </h2>
            {description ? (
              <p className="text-ink-secondary mt-1 text-[13px] leading-5">{description}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mr-1 h-8 w-8 shrink-0 px-0"
            onClick={onClose}
            disabled={preventClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {children}
        </div>
        {footer ? (
          <div className="border-border bg-surface-muted/40 flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
