"use client";

import type { ReactNode } from "react";

export type AdminTableColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type AdminTableProps<T> = {
  columns: AdminTableColumn<T>[];
  error: string;
  getRowKey: (row: T) => string;
  loading: boolean;
  onRetry: () => void;
  onRowClick?: (row: T) => void;
  rows: T[];
};

function TableSkeleton({ columnCount }: { columnCount: number }) {
  return (
    <div aria-label="Loading admin records" aria-live="polite" className="space-y-3 p-4">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="grid gap-3 md:grid-cols-4" style={{ gridTemplateColumns: `repeat(${Math.max(columnCount, 1)}, minmax(0, 1fr))` }}>
          {Array.from({ length: columnCount }, (_, cellIndex) => (
            <div key={cellIndex} className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AdminTable<T>({ columns, error, getRowKey, loading, onRetry, onRowClick, rows }: AdminTableProps<T>) {
  if (loading) return <TableSkeleton columnCount={columns.length} />;

  if (error) {
    return (
      <div role="alert" className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
        <p>{error}</p>
        <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-black px-3 py-2 font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-300 dark:bg-white dark:text-black">
          Retry
        </button>
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">No records match the current filters.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left" aria-label="Admin records">
        <thead className="border-b border-gray-200 text-xs uppercase tracking-[0.14em] text-gray-500 dark:border-gray-800 dark:text-gray-400">
          <tr>
            {columns.map((column) => <th key={column.key} scope="col" className={`whitespace-nowrap px-4 py-3 font-semibold ${column.className ?? ""}`}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(event) => {
                if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onRowClick(row);
                }
              }}
              className={onRowClick ? "cursor-pointer outline-none transition-colors hover:bg-gray-50 focus:bg-yellow-50 dark:hover:bg-gray-900/60 dark:focus:bg-yellow-950/20" : ""}
            >
              {columns.map((column) => <td key={column.key} className={`max-w-[280px] px-4 py-4 align-middle text-sm ${column.className ?? ""}`}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
