"use client";

// FilterBar — the agile filtering surface: a free-text search, a compact "add filter"
// composer with type-aware operators, and the active filters rendered as removable tokens
// (a small "query ledger" that echoes the app's provenance-ledger motif). Fully driven by
// props, so it can sit on top of the schema explorer, cohort results, or quality findings.

import { useEffect, useRef, useState } from "react";
import {
  ColumnMeta,
  Filter,
  FilterOp,
  defaultOp,
  opsForKind,
} from "./useTableExplorer";

type Props = {
  columns: ColumnMeta[];
  filters: Filter[];
  onAdd: (f: Omit<Filter, "id">) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  search: string;
  onSearchChange: (s: string) => void;
  onSearchCommit: () => void;
  searchPlaceholder?: string;
};

export function FilterBar({
  columns,
  filters,
  onAdd,
  onRemove,
  onClear,
  search,
  onSearchChange,
  onSearchCommit,
  searchPlaceholder = "Search all columns",
}: Props) {
  const [open, setOpen] = useState(false);
  const [col, setCol] = useState("");
  const [op, setOp] = useState<FilterOp>("contains");
  const [val, setVal] = useState("");
  const valRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const meta = columns.find((c) => c.name === col);
  const kind = meta?.kind ?? "text";
  const ops = opsForKind(kind);

  // When the composer opens, seed a sensible column + operator and focus the value.
  useEffect(() => {
    if (open && !col && columns.length) {
      const first = columns[0];
      setCol(first.name);
      setOp(defaultOp(first.kind));
    }
    if (open) requestAnimationFrame(() => valRef.current?.focus());
  }, [open, col, columns]);

  // Dismiss the composer on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pickColumn(name: string) {
    setCol(name);
    const k = columns.find((c) => c.name === name)?.kind ?? "text";
    setOp(defaultOp(k));
    setVal("");
  }

  function submit() {
    if (!col || val.trim() === "") return;
    onAdd({ col, op, val: val.trim() });
    setVal("");
    setOpen(false);
  }

  const active = filters.length > 0 || search.trim() !== "";

  return (
    <div className="fbar">
      <div className="fbar-row">
        <div className="fbar-search">
          <span className="fbar-search-i" aria-hidden>⌕</span>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearchCommit()}
            onBlur={onSearchCommit}
            placeholder={searchPlaceholder}
            aria-label="Search all columns"
          />
        </div>

        <div className="fbar-add" ref={composerRef}>
          <button
            type="button"
            className="btn btn-ghost fbar-addbtn"
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((o) => !o)}
          >
            + Add filter
          </button>

          {open && (
            <div className="composer" role="dialog" aria-label="Add a column filter">
              <div className="composer-h lbl">Filter a column</div>
              <div className="composer-grid">
                <label className="lbl" htmlFor="fc-col">Column</label>
                <select id="fc-col" value={col} onChange={(e) => pickColumn(e.target.value)}>
                  {columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} · {c.kind}
                    </option>
                  ))}
                </select>

                <label className="lbl" htmlFor="fc-op">Is</label>
                <select id="fc-op" value={op} onChange={(e) => setOp(e.target.value as FilterOp)}>
                  {ops.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>

                <label className="lbl" htmlFor="fc-val">Value</label>
                <input
                  id="fc-val"
                  ref={valRef}
                  className="search"
                  type={kind === "number" ? "number" : "text"}
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  placeholder={kind === "time" ? "YYYY-MM-DD…" : kind === "number" ? "0" : "value"}
                />
              </div>
              <div className="composer-f">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="button" className="btn" onClick={submit} disabled={!col || val.trim() === ""}>
                  Add filter
                </button>
              </div>
            </div>
          )}
        </div>

        {active && (
          <button type="button" className="fbar-clear" onClick={onClear}>
            Clear all
          </button>
        )}
      </div>

      {(filters.length > 0 || search.trim() !== "") && (
        <div className="ftoks" aria-label="Active filters">
          {search.trim() !== "" && (
            <span className="ftok">
              <span className="ftok-k">search</span>
              <span className="ftok-op">⌕</span>
              <span className="ftok-v">{search.trim()}</span>
              <button className="ftok-x" aria-label="Remove search" onClick={() => { onSearchChange(""); onSearchCommit(); }}>×</button>
            </span>
          )}
          {filters.map((f, i) => (
            <span key={f.id} className="ftok">
              <span className="ftok-k">{f.col}</span>
              <span className="ftok-op">{f.op}</span>
              <span className="ftok-v" title={f.val}>{f.val}</span>
              {i > 0 && <span className="ftok-tag" title="Refined on the current page">on page</span>}
              <button className="ftok-x" aria-label={`Remove filter ${f.col} ${f.op} ${f.val}`} onClick={() => onRemove(f.id)}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
