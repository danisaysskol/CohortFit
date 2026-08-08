// A small, dependency-free line-icon set (24px, currentColor). One component, one
// source of truth — used in the nav, buttons, tiles, findings, and the schema map.

export type IconName =
  | "search" | "database" | "table" | "chart" | "activity" | "flask" | "pill"
  | "user" | "users" | "check" | "alert" | "x" | "arrow" | "chevron" | "filter"
  | "layers" | "clock" | "hash" | "shield" | "spark" | "sitemap" | "play" | "info"
  | "key" | "link";

const P: Record<IconName, string> = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.35-4.35",
  database: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  table: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  activity: "M22 12h-4l-3 8-4-16-3 8H2",
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7 15h10",
  pill: "M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7zM8 8l8 8",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3.5-6 7-6M17 11a3 3 0 1 0 0-6M15 15c4 0 7 2 7 6",
  check: "M20 6 9 17l-5-5",
  alert: "M12 3 2 20h20L12 3zM12 9v5M12 17.5v.5",
  x: "M18 6 6 18M6 6l12 12",
  arrow: "M5 12h14M13 6l6 6-6 6",
  chevron: "M6 9l6 6 6-6",
  filter: "M3 5h18l-7 8v6l-4 2v-8L3 5z",
  layers: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  hash: "M4 9h16M4 15h16M10 3 8 21M16 3l-2 18",
  shield: "M12 3 20 6v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z",
  sitemap: "M9 3h6v4H9zM3 17h6v4H3zM15 17h6v4h-6zM12 7v4M6 17v-3h12v3",
  play: "M6 4l14 8-14 8V4z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5v.5",
  key: "M15 7a4 4 0 1 1-3.9 5H8v3H5v-3H3v-3h8.1A4 4 0 0 1 15 7z",
  link: "M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1",
};

export function Icon({ name, size = 16, className, style }: { name: IconName; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
         className={className} style={style} aria-hidden="true" focusable="false">
      <path d={P[name]} />
    </svg>
  );
}
