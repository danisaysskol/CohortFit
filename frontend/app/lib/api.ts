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
export type ExploreResult = {
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
};
export type ForeignKey = { col: string; ref: string };
export type TableInfo = {
  table: string;
  module: string;
  rows: number;
  columns: Column[];
  join_keys: string[];
  timestamps: string[];
  pk: string[];
  fk: ForeignKey[];
};
export type FunnelStep = { criterion: string; source: string; remaining: number; delta: number | null };
export type Disposition = "cohort" | "clarify" | "refuse" | "abstain";
export type CohortResult = {
  method: string;
  disposition?: Disposition;
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
export type ScoreSummary = {
  issues_found: number;
  findings_total: number;
  assumed_minutes_per_issue: number;
  reviewer_minutes_saved_estimate: number;
  note: string;
};
export type Scorecard = {
  dimensions: { dimension: string; severity: "red" | "amber" | "green" }[];
  findings: Finding[];
  summary: ScoreSummary;
};
export type AggStat = { mean: number; std: number; min: number; max: number };
export type EvalResult = {
  seeds: number[];
  runs: Record<string, number | string>[];
  aggregate: Record<"precision" | "recall" | "f1" | "false_positive_rate", AggStat>;
  baseline: { strategy: string; precision: number; recall: number; false_positive_rate: number };
  note: string;
};

export type Fix = {
  id: string;
  table: string;
  ref: string;
  title: string;
  detail: string;
  rule: string;
  reverse: string;
  affected: number;
  reversible: boolean;
};

export const api = {
  health: () => get<{ status: string; tables: number }>("/health"),
  schema: () => get<{ tables: TableInfo[] }>("/schema"),
  table: (t: string, limit = 25) =>
    get<{ table: string; columns: string[]; rows: Record<string, unknown>[] }>(`/schema/${t}?limit=${limit}`),
  explore: (t: string, params: Record<string, string>) =>
    get<ExploreResult>(`/explore/${t}?${new URLSearchParams(params).toString()}`),
  buildCohort: (text: string) => post<CohortResult>("/cohort/build", { text }),
  scorecard: () => get<Scorecard>("/quality/scorecard"),
  fixes: () => get<{ fixes: Fix[]; note: string }>("/quality/fixes"),
  runEval: () => get<EvalResult>("/eval/run"),
};
