"use client";

// DataTable — a presentational, reusable grid. It knows nothing about the schema page:
// give it column metadata and rows and it renders a modern table with a sticky hairline
// header, sortable columns, type-aware alignment + tabular figures, graceful null and
// truncation handling, and tidy loading / empty states. Reusable for cohort results and
// quality findings.

import { ColumnMeta, SortState } from "./useTableExplorer";

type Props = {
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
  sort?: SortState;
  onSort?: (col: string) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  maxCell?: number;
};

function format(value: unknown): { text: string; isNull: boolean } {
  if (value === null || value === undefined || value === "") return { text: "·", isNull: true };
  return { text: String(value), isNull: false };
}

export function DataTable({
  columns,
  rows,
  sort,
  onSort,
  loading = false,
  emptyTitle = "No rows match",
  emptyHint = "Loosen a filter or clear the search to see more.",
  maxCell = 44,
}: Props) {
  const sortable = !!onSort;

  return (
    <div className="dtwrap">
      <table className="dt">
        <thead>
          <tr>
            {columns.map((c) => {
              const isSorted = sort?.col === c.name;
              const dir = isSorted ? sort!.dir : undefined;
              return (
                <th
                  key={c.name}
                  className={c.align === "right" ? "dt-right" : undefined}
                  aria-sort={isSorted ? (dir === "asc" ? "ascending" : "descending") : "none"}
                >
                  {sortable ? (
                    <button
                      type="button"
                      className={"dt-sort" + (isSorted ? " on" : "")}
                      onClick={() => onSort!(c.name)}
                      title={`Sort by ${c.name}`}
                    >
                      <span className="dt-col">{c.name}</span>
                      <span className="dt-caret" aria-hidden>
                        {isSorted ? (dir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  ) : (
                    <span className="dt-col">{c.name}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 && (
            <tr className="dt-state">
              <td colSpan={columns.length || 1}>
                <span className="loading">Loading rows…</span>
              </td>
            </tr>
          )}

          {!loading && rows.length === 0 && (
            <tr className="dt-state">
              <td colSpan={columns.length || 1}>
                <div className="dt-empty">
                  <div className="dt-empty-t">{emptyTitle}</div>
                  <div className="dt-empty-h">{emptyHint}</div>
                </div>
              </td>
            </tr>
          )}

          {rows.map((row, i) => (
            <tr key={i} className={loading ? "dt-dim" : undefined}>
              {columns.map((c) => {
                const { text, isNull } = format(row[c.name]);
                const truncated = !isNull && text.length > maxCell;
                return (
                  <td key={c.name} className={c.align === "right" ? "dt-cell dt-right" : "dt-cell"}>
                    {isNull ? (
                      <span className="dt-null" title="No value">·</span>
                    ) : (
                      <span title={truncated ? text : undefined}>
                        {truncated ? text.slice(0, maxCell) + "…" : text}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
