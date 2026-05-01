/**
 * Licence expiry helpers — colored status, prompt copy, summary across all licences.
 */
import type { LicenceEntry } from "./data";

export type ExpiryStatus = "ok" | "soon" | "urgent" | "expired" | "no-date";

export interface LicenceStatusInfo {
  status: ExpiryStatus;
  daysRemaining: number | null;
  label: string;
  /** Tailwind-friendly status helpers — defined in styles.css */
  colorClass: string;       // text color
  bgClass: string;          // background tint
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const ONE_YEAR_DAYS = 365;
const THREE_MONTHS_DAYS = 90;

function humanise(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} left`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months} month${months === 1 ? "" : "s"} left`;
  }
  const years = Math.floor(days / 365);
  const months = Math.round((days % 365) / 30);
  return months === 0
    ? `${years} year${years === 1 ? "" : "s"} left`
    : `${years}y ${months}m left`;
}

export function getLicenceStatus(expiry: string | null | undefined): LicenceStatusInfo {
  if (!expiry) {
    return { status: "no-date", daysRemaining: null, label: "No expiry set", colorClass: "text-muted-foreground", bgClass: "glass-subtle" };
  }
  const exp = new Date(expiry);
  if (Number.isNaN(exp.getTime())) {
    return { status: "no-date", daysRemaining: null, label: "Invalid date", colorClass: "text-muted-foreground", bgClass: "glass-subtle" };
  }
  const now = new Date();
  const days = Math.floor((exp.getTime() - now.getTime()) / MS_PER_DAY);

  if (days < 0) {
    return { status: "expired", daysRemaining: days, label: humanise(days), colorClass: "status-red", bgClass: "bg-status-red" };
  }
  if (days < THREE_MONTHS_DAYS) {
    return { status: "urgent", daysRemaining: days, label: humanise(days), colorClass: "status-red", bgClass: "bg-status-red" };
  }
  if (days < ONE_YEAR_DAYS) {
    return { status: "soon", daysRemaining: days, label: humanise(days), colorClass: "status-amber", bgClass: "bg-status-amber" };
  }
  return { status: "ok", daysRemaining: days, label: humanise(days), colorClass: "status-green", bgClass: "bg-status-green" };
}

export interface ExpirySummary {
  expired: LicenceEntry[];
  urgent: LicenceEntry[];   // < 3 months
  soon: LicenceEntry[];     // < 1 year
}

export function summariseLicences(licences: LicenceEntry[]): ExpirySummary {
  const out: ExpirySummary = { expired: [], urgent: [], soon: [] };
  for (const l of licences) {
    const s = getLicenceStatus(l.expiry_date);
    if (s.status === "expired") out.expired.push(l);
    else if (s.status === "urgent") out.urgent.push(l);
    else if (s.status === "soon") out.soon.push(l);
  }
  return out;
}

export function expiryPromptMessage(s: ExpirySummary): { title: string; description: string; level: "urgent" | "soon" } | null {
  if (s.expired.length > 0 || s.urgent.length > 0) {
    return {
      level: "urgent",
      title: "URGENT: Licence close to expiry",
      description: "Take action immediately on your licences and renew before they lapse.",
    };
  }
  if (s.soon.length > 0) {
    return {
      level: "soon",
      title: "Licence approaching expiry",
      description: "Start preparing for renewal — one or more of your licences expire within a year.",
    };
  }
  return null;
}
