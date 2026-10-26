import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function TableContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('scrollbar-subtle w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[860px] border-collapse">{children}</table>
    </div>
  );
}

export function THead({ children, className }: { children: ReactNode; className?: string }) {
  return <thead className={cn('table-head', className)}>{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="bg-surface">{children}</tbody>;
}

export function TR({
  children,
  className,
  ...props
}: TableHTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) {
  return (
    <tr className={cn('table-row', className)} {...props}>
      {children}
    </tr>
  );
}

export function TH({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <th
      scope="col"
      className={cn('whitespace-nowrap px-4 py-2.5 font-semibold', className)}
      {...props}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <td className={cn('table-cell', className)} {...props}>
      {children}
    </td>
  );
}
