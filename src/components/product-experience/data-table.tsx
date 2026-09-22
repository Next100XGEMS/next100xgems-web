import type { ReactNode } from "react";

import { cx } from "./cx";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  align?: "left" | "right" | "center";
  className?: string;
  render: (row: T) => ReactNode;
};

export type DataTableProps<T> = {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  empty?: ReactNode;
  caption?: string;
  className?: string;
  onRowSelect?: (row: T) => void;
  selectedRowId?: string | null;
  dense?: boolean;
};

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  empty,
  caption,
  className,
  onRowSelect,
  selectedRowId,
  dense = true,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <div className={className}>{empty}</div>;
  }

  const alignClass = {
    left: "text-left",
    right: "text-right",
    center: "text-center",
  } as const;

  return (
    <div className={cx("overflow-x-auto border border-[var(--n100-border-subtle)]", className)}>
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="border-b border-[var(--n100-border-subtle)] bg-[var(--n100-surface-secondary)]/60">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cx(
                  "px-3 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]",
                  dense ? "py-2" : "py-3",
                  alignClass[column.align ?? "left"],
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowId = getRowId(row);
            const selected = selectedRowId === rowId;
            return (
              <tr
                key={rowId}
                tabIndex={onRowSelect ? 0 : undefined}
                aria-selected={onRowSelect ? selected : undefined}
                className={cx(
                  "border-b border-[var(--n100-border-subtle)]/80 last:border-b-0",
                  onRowSelect && "cursor-pointer hover:bg-[var(--n100-surface-secondary)]/45",
                  selected && "bg-[var(--n100-accent)]/6",
                )}
                onClick={onRowSelect ? () => onRowSelect(row) : undefined}
                onKeyDown={
                  onRowSelect
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowSelect(row);
                        }
                      }
                    : undefined
                }
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cx(
                      "px-3 text-[var(--n100-text-secondary)]",
                      dense ? "py-2.5" : "py-3.5",
                      alignClass[column.align ?? "left"],
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
