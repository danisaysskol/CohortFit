"use client";

// useTableExplorer — a small, reusable orchestrator for "filter + sort + page through rows"
// experiences. It is deliberately UI-agnostic and backend-agnostic: give it a `fetcher`
// that returns { columns, rows, total } and a list of columns, and it manages filter chips,
// free-text search, client-side sort, and pagination. The Schema page consumes it today;
// cohort results and quality findings can reuse it by passing their own fetcher.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ColumnKind = "number" | "text" | "time";
export type FilterOp = "contains" | "=" | "!=" | ">" | ">=" | "<" | "<=";

export type ColumnMeta = {
  name: string;
  type?: string; // raw backend type, e.g. BIGINT / VARCHAR / TIMESTAMP
  kind: ColumnKind;
  align: "left" | "right";
};

export type Filter = { id: string; col: string; op: FilterOp; val: string };
export type SortState = { col: string; dir: "asc" | "desc" } | null;

export type ExplorePage = {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
};

// The params shape mirrors the backend contract: one structured filter + one search.
export type ExploreParams = {
  limit: number;
  offset: number;
  col?: string;
  op?: string;
  val?: string;
  search?: string;
};

const NUM_TYPES = /(INT|DEC|NUM|DOUBLE|FLOAT|REAL|SERIAL)/i;
const TIME_TYPES = /(TIMESTAMP|DATE|TIME)/i;

export function deriveKind(type?: string): ColumnKind {
  if (!type) return "text";
  if (TIME_TYPES.test(type)) return "time";
  if (NUM_TYPES.test(type)) return "number";
  return "text";
}

export function toColumnMeta(cols: { name: string; type?: string }[]): ColumnMeta[] {
  return cols.map((c) => {
    const kind = deriveKind(c.type);
    return { name: c.name, type: c.type, kind, align: kind === "number" ? "right" : "left" };
  });
}

// Type-aware operator menus. Text can't be ordered; numbers/times get comparison ops.
export function opsForKind(kind: ColumnKind): FilterOp[] {
  if (kind === "number") return ["=", "!=", ">", ">=", "<", "<="];
  if (kind === "time") return ["=", "!=", ">", ">=", "<", "<=", "contains"];
  return ["contains", "=", "!="];
}

export function defaultOp(kind: ColumnKind): FilterOp {
  return kind === "text" ? "contains" : ">=";
}

let _id = 0;
const nextId = () => `f${++_id}`;

// Client-side predicate for refinement filters (chips beyond the first, which the
// single-filter backend can't apply itself). Kept honest: these refine the current page.
function matches(row: Record<string, unknown>, f: Filter, kind: ColumnKind): boolean {
  const raw = row[f.col];
  if (raw === null || raw === undefined || raw === "") return false;
  if (kind === "number") {
    const a = Number(raw);
    const b = Number(f.val);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    switch (f.op) {
      case "=": return a === b;
      case "!=": return a !== b;
      case ">": return a > b;
      case ">=": return a >= b;
      case "<": return a < b;
      case "<=": return a <= b;
      default: return true;
    }
  }
  const a = String(raw).toLowerCase();
  const b = f.val.toLowerCase();
  switch (f.op) {
    case "contains": return a.includes(b);
    case "=": return a === b;
    case "!=": return a !== b;
    case ">": return a > b;
    case ">=": return a >= b;
    case "<": return a < b;
    case "<=": return a <= b;
    default: return true;
  }
}

export type UseTableExplorer = {
  columns: ColumnMeta[];
  rows: Record<string, unknown>[]; // visible rows (client filters + sort applied)
  total: number; // server total for the primary filter + search
  serverMatched: number; // rows returned on this page before client refinement
  loading: boolean;
  error: string | null;

  filters: Filter[];
  addFilter: (f: Omit<Filter, "id">) => void;
  removeFilter: (id: string) => void;
  clearFilters: () => void;
  hasClientRefinement: boolean;

  search: string;
  setSearch: (s: string) => void;
  commitSearch: () => void;

  sort: SortState;
  toggleSort: (col: string) => void;

  offset: number;
  pageSize: number;
  next: () => void;
  prev: () => void;
  canPrev: boolean;
  canNext: boolean;
  refresh: () => void;
};

export function useTableExplorer(opts: {
  columns: ColumnMeta[];
  fetcher: (params: ExploreParams) => Promise<ExplorePage>;
  pageSize?: number;
  // When resetKey changes (e.g. a new table is selected) all filters/sort/paging reset.
  resetKey?: string;
}): UseTableExplorer {
  const { columns, fetcher, resetKey } = opts;
  const pageSize = opts.pageSize ?? 25;

  const [filters, setFilters] = useState<Filter[]>([]);
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<ExplorePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const kindOf = useCallback(
    (col: string) => columns.find((c) => c.name === col)?.kind ?? "text",
    [columns]
  );

  // Reset everything when the caller switches context (e.g. table).
  useEffect(() => {
    setFilters([]);
    setSearch("");
    setCommittedSearch("");
    setSort(null);
    setOffset(0);
    setPage(null);
    setError(null);
  }, [resetKey]);

  // The first structured filter is server-authoritative (drives total + pagination).
  const primary = filters[0];
  const primaryKey = primary ? `${primary.col}|${primary.op}|${primary.val}` : "";

  const reqRef = useRef(0);
  const runFetch = useCallback(async () => {
    const token = ++reqRef.current;
    setLoading(true);
    setError(null);
    const params: ExploreParams = { limit: pageSize, offset };
    if (primary && primary.val !== "") {
      params.col = primary.col;
      params.op = primary.op;
      params.val = primary.val;
    }
    if (committedSearch) params.search = committedSearch;
    try {
      const data = await fetcher(params);
      if (token === reqRef.current) setPage(data);
    } catch (e) {
      if (token === reqRef.current) setError(String(e));
    } finally {
      if (token === reqRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher, pageSize, offset, primaryKey, committedSearch]);

  useEffect(() => {
    runFetch();
  }, [runFetch, resetKey]);

  // Additional filters (chips beyond the first) refine the fetched page client-side.
  const refinements = filters.slice(1);
  const serverRows = page?.rows ?? [];
  const refined = useMemo(() => {
    if (!refinements.length) return serverRows;
    return serverRows.filter((r) => refinements.every((f) => matches(r, f, kindOf(f.col))));
  }, [serverRows, refinements, kindOf]);

  const visible = useMemo(() => {
    if (!sort) return refined;
    const k = kindOf(sort.col);
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...refined].sort((ra, rb) => {
      const a = ra[sort.col];
      const b = rb[sort.col];
      if (a === null || a === undefined || a === "") return 1; // nulls last
      if (b === null || b === undefined || b === "") return -1;
      if (k === "number") return (Number(a) - Number(b)) * dir;
      return String(a).localeCompare(String(b)) * dir;
    });
  }, [refined, sort, kindOf]);

  const total = page?.total ?? 0;

  const addFilter = useCallback((f: Omit<Filter, "id">) => {
    setOffset(0);
    setFilters((prev) => [...prev, { ...f, id: nextId() }]);
  }, []);
  const removeFilter = useCallback((id: string) => {
    setOffset(0);
    setFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);
  const clearFilters = useCallback(() => {
    setOffset(0);
    setFilters([]);
    setSearch("");
    setCommittedSearch("");
  }, []);

  const commitSearch = useCallback(() => {
    setOffset(0);
    setCommittedSearch(search.trim());
  }, [search]);

  const toggleSort = useCallback((col: string) => {
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return null; // third click clears sort
    });
  }, []);

  const next = useCallback(() => {
    setOffset((o) => (o + pageSize < total ? o + pageSize : o));
  }, [pageSize, total]);
  const prev = useCallback(() => {
    setOffset((o) => Math.max(0, o - pageSize));
  }, [pageSize]);

  return {
    columns,
    rows: visible,
    total,
    serverMatched: serverRows.length,
    loading,
    error,
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    hasClientRefinement: refinements.length > 0,
    search,
    setSearch,
    commitSearch,
    sort,
    toggleSort,
    offset,
    pageSize,
    next,
    prev,
    canPrev: offset > 0,
    canNext: offset + pageSize < total,
    refresh: runFetch,
  };
}
