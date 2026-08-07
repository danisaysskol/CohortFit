// Thin client to the CohortFit backend. Base URL is configurable so the same build
// runs locally and in Docker. The browser calls the host-mapped backend port.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

export type Column = { name: string; type: string };
export type TableInfo = {
  table: string;
  module: string;
  rows: number;
  columns: Column[];
  join_keys: string[];
  timestamps: string[];
};
export type FunnelStep = { criterion: string; source: string; remaining: number; delta: number | null };
export type CohortResult = {
  method: string;
  ir: unknown;
  sql?: string;
  funnel?: FunnelStep[];
  subject_ids?: string[];
  n?: number;
  answerable: boolean;
  abstain_reason?: string;
  confidence?: number;
};
export type Finding = {
  dimension: string;
  severity: "red" | "amber" | "green";
  table: string;
  detail: string;
  count: number;
  kind: "data_error" | "real_finding" | "caveat";
  ref: string;
};
export type Scorecard = {
  dimensions: { dimension: string; severity: "red" | "amber" | "green" }[];
  findings: Finding[];
};
export type EvalResult = {
  results: Record<string, number | string>[];
  note: string;
};

export const api = {
  health: () => get<{ status: string; tables: number }>("/health"),
  schema: () => get<{ tables: TableInfo[] }>("/schema"),
  table: (t: string, limit = 25) =>
    get<{ table: string; columns: string[]; rows: Record<string, unknown>[] }>(`/schema/${t}?limit=${limit}`),
  buildCohort: (text: string) => post<CohortResult>("/cohort/build", { text }),
  scorecard: () => get<Scorecard>("/quality/scorecard"),
  runEval: () => get<EvalResult>("/eval/run"),
};
