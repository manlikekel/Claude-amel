/**
 * Pure analytics helpers for the dashboard. Operate on already-fetched logs
 * so filters and grouping happen client-side without extra round-trips.
 */
import type { LogEntry } from "./data";

export type TimeRange = "24h" | "1w" | "1m" | "1y" | "5y" | "all";

export const TIME_RANGE_LABEL: Record<TimeRange, string> = {
  "24h": "24 Hours",
  "1w": "1 Week",
  "1m": "1 Month",
  "1y": "1 Year",
  "5y": "5 Years",
  all: "All Time",
};

export function rangeStart(range: TimeRange): Date | null {
  if (range === "all") return null;
  const now = Date.now();
  const ms = {
    "24h": 24 * 60 * 60 * 1000,
    "1w": 7 * 24 * 60 * 60 * 1000,
    "1m": 30 * 24 * 60 * 60 * 1000,
    "1y": 365 * 24 * 60 * 60 * 1000,
    "5y": 5 * 365 * 24 * 60 * 60 * 1000,
  }[range];
  return new Date(now - ms);
}

export interface AnalyticsFilters {
  range: TimeRange;
  aircraftType: string; // "all" or a model string
  registration: string; // "all" or a registration string
}

export function applyFilters(logs: LogEntry[], f: AnalyticsFilters): LogEntry[] {
  const start = rangeStart(f.range);
  return logs.filter((l) => {
    if (start && new Date(l.created_at) < start) return false;
    if (f.aircraftType !== "all" && (l.aircraft_model || "").trim().toUpperCase() !== f.aircraftType.toUpperCase()) return false;
    if (f.registration !== "all" && (l.registration || "").trim().toUpperCase() !== f.registration.toUpperCase()) return false;
    return true;
  });
}

export interface OverviewStats {
  totalTasks: number;
  totalAircraft: number;
  totalHours: number;
  ataCoverage: number;
}

export function overviewStats(logs: LogEntry[]): OverviewStats {
  const aircraft = new Set<string>();
  const ata = new Set<string>();
  let hours = 0;
  for (const l of logs) {
    if (l.aircraft_model) aircraft.add(l.aircraft_model.trim().toUpperCase());
    const code = (l.ata_chapter || "").match(/\d{1,2}/)?.[0];
    if (code) ata.add(code.padStart(2, "0"));
    hours += l.time_spent_hours || 0;
  }
  return {
    totalTasks: logs.length,
    totalAircraft: aircraft.size,
    totalHours: Math.round(hours * 10) / 10,
    ataCoverage: ata.size,
  };
}

export interface PieDatum {
  id: string;
  label: string;
  value: number;
}

/** Dimension changes based on what's selected. */
export function pieData(logs: LogEntry[], f: AnalyticsFilters): { data: PieDatum[]; dimension: string } {
  const acc = new Map<string, number>();
  let dimension = "Aircraft Type";
  let keyFn: (l: LogEntry) => string = (l) => (l.aircraft_model || "Unknown").trim().toUpperCase();

  if (f.aircraftType !== "all" && f.registration === "all") {
    dimension = "Registration";
    keyFn = (l) => (l.registration || "Unknown").trim().toUpperCase();
  } else if (f.registration !== "all") {
    dimension = "ATA Chapter";
    keyFn = (l) => {
      const code = (l.ata_chapter || "").match(/\d{1,2}/)?.[0];
      return code ? `ATA ${code.padStart(2, "0")}` : "Other";
    };
  }

  for (const l of logs) {
    const k = keyFn(l);
    acc.set(k, (acc.get(k) || 0) + (l.time_spent_hours || 0));
  }
  const data = [...acc.entries()]
    .map(([k, v]) => ({ id: k, label: k, value: Math.round(v * 10) / 10 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  return { data, dimension };
}

export interface SeriesPoint { x: string; y: number }

/** Bucket man-hours by appropriate time granularity for the range. */
export function timeSeries(logs: LogEntry[], range: TimeRange): { points: SeriesPoint[]; granularity: string } {
  let granularity: string;
  let bucketKey: (d: Date) => string;
  let labelFmt: (key: string) => string;

  const pad = (n: number) => String(n).padStart(2, "0");

  switch (range) {
    case "24h":
      granularity = "Hourly";
      bucketKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}h`;
      labelFmt = (k) => k.split(" ")[1];
      break;
    case "1w":
    case "1m":
      granularity = "Daily";
      bucketKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      labelFmt = (k) => k.slice(5);
      break;
    case "1y":
      granularity = "Monthly";
      bucketKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      labelFmt = (k) => k;
      break;
    case "5y":
      granularity = "Yearly";
      bucketKey = (d) => `${d.getFullYear()}`;
      labelFmt = (k) => k;
      break;
    default:
      granularity = "Monthly";
      bucketKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      labelFmt = (k) => k;
  }

  const acc = new Map<string, number>();
  for (const l of logs) {
    const d = new Date(l.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const k = bucketKey(d);
    acc.set(k, (acc.get(k) || 0) + (l.time_spent_hours || 0));
  }
  const points = [...acc.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => ({ x: labelFmt(k), y: Math.round(v * 10) / 10 }));
  return { points, granularity };
}

export function uniqueAircraftTypes(logs: LogEntry[]): string[] {
  const s = new Set<string>();
  for (const l of logs) if (l.aircraft_model) s.add(l.aircraft_model.trim().toUpperCase());
  return [...s].sort();
}

export function uniqueRegistrations(logs: LogEntry[]): string[] {
  const s = new Set<string>();
  for (const l of logs) if (l.registration) s.add(l.registration.trim().toUpperCase());
  return [...s].sort();
}
