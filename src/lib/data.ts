/**
 * Cloud-backed data access layer for AMEL.
 *
 * All persistence is via Lovable Cloud (Supabase). RLS scopes everything
 * to the signed-in user automatically. No localStorage fallback — this app
 * is online-first; an unsigned-in user is gated to the auth screen.
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizeRegistration } from "./aircraft";
import {
  bulkPutServerLogs, getAllLogs as getLocalLogs, getLog as getLocalLog,
  putLog as putLocalLog, deleteLogLocal, enqueue,
  type LocalLog,
} from "./offline-db";
import { isOnline, drainQueue } from "./sync";

// ============ TYPES (mirror Supabase rows but flattened for UI) ============

export type LicenceFramework = "NCAA" | "EASA" | "FAA";

export interface ProfileData {
  name: string;
  email: string;
  phone: string;
  ame_licence_no: string;
  address: string;
  share_to_community_default?: boolean;
  country_region?: string;
  target_framework?: LicenceFramework | null;
  active_organization_id?: string | null;
}

export interface LicenceEntry {
  id: string;
  authority: string;
  licence_type: string;
  licence_number: string;
  ratings: string;
  issue_date: string;
  expiry_date: string;
  remarks: string;
}

export interface AircraftProfile {
  id: string;
  registration: string;
  normalized_registration: string;
  model: string | null;
  manufacturer: string | null;
  aircraft_type_code: string | null;
  icao24: string | null;
  serial_number: string | null;
  operator_name: string | null;
  remarks: string | null;
  lookup_source: string | null;
  lookup_status: string | null;
  is_manual_override: boolean;
}

export type LogVisibility = "personal" | "team" | "public_anon";

export interface LogEntry {
  id: string;
  aircraft_profile_id: string | null;
  registration: string;
  aircraft_model: string;
  manufacturer: string;
  ata_chapter: string;
  fault_description: string;
  symptoms: string[];
  root_cause: string;
  action_taken: string;
  tools_used: string;
  time_spent_hours: number;
  is_recurring: boolean;
  image_urls: string[];
  voice_note_url: string | null;
  created_at: string;
  system_component?: string;
  maintenance_reference?: string;
  share_to_community?: boolean;
  visibility?: LogVisibility;
  organization_id?: string | null;
}

// ============ PROFILE ============

const EMPTY_PROFILE: ProfileData = {
  name: "",
  email: "",
  phone: "",
  ame_licence_no: "",
  address: "",
  share_to_community_default: true,
  country_region: "",
  target_framework: null,
  active_organization_id: null,
};

export async function fetchProfile(): Promise<ProfileData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY_PROFILE;
  const { data, error } = await supabase
    .from("profiles")
    .select("name,email,phone,ame_licence_no,address,share_to_community_default,country_region,target_framework,active_organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error(error);
    return EMPTY_PROFILE;
  }
  return {
    name: data?.name ?? "",
    email: data?.email ?? user.email ?? "",
    phone: data?.phone ?? "",
    ame_licence_no: data?.ame_licence_no ?? "",
    address: data?.address ?? "",
    share_to_community_default: data?.share_to_community_default ?? true,
    country_region: data?.country_region ?? "",
    target_framework: (data?.target_framework as any) ?? null,
    active_organization_id: data?.active_organization_id ?? null,
  };
}

export async function saveProfile(p: ProfileData): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("profiles")
    .update({
      name: p.name,
      email: p.email,
      phone: p.phone,
      ame_licence_no: p.ame_licence_no,
      address: p.address,
      share_to_community_default: p.share_to_community_default,
      country_region: p.country_region,
      target_framework: p.target_framework ?? null,
      active_organization_id: p.active_organization_id ?? null,
    })
    .eq("user_id", user.id);
  if (error) throw error;
}

// ============ LICENCES ============

export async function fetchLicences(): Promise<LicenceEntry[]> {
  const { data, error } = await supabase
    .from("licences")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return (data ?? []).map((l) => ({
    id: l.id,
    authority: l.authority ?? "",
    licence_type: l.licence_type ?? "",
    licence_number: l.licence_number ?? "",
    ratings: l.ratings ?? "",
    issue_date: l.issue_date ?? "",
    expiry_date: l.expiry_date ?? "",
    remarks: l.remarks ?? "",
  }));
}

export async function saveLicence(l: Omit<LicenceEntry, "id">): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase.from("licences").insert({
    user_id: user.id,
    authority: l.authority,
    licence_type: l.licence_type,
    licence_number: l.licence_number,
    ratings: l.ratings,
    issue_date: l.issue_date || null,
    expiry_date: l.expiry_date || null,
    remarks: l.remarks,
  });
  if (error) throw error;
}

export async function updateLicence(id: string, l: Omit<LicenceEntry, "id">): Promise<void> {
  const { error } = await supabase.from("licences").update({
    authority: l.authority,
    licence_type: l.licence_type,
    licence_number: l.licence_number,
    ratings: l.ratings,
    issue_date: l.issue_date || null,
    expiry_date: l.expiry_date || null,
    remarks: l.remarks,
  }).eq("id", id);
  if (error) throw error;
}

export async function deleteLicence(id: string): Promise<void> {
  const { error } = await supabase.from("licences").delete().eq("id", id);
  if (error) throw error;
}

// ============ AIRCRAFT PROFILES ============

export async function fetchAircraftProfiles(): Promise<AircraftProfile[]> {
  const { data, error } = await supabase
    .from("aircraft_profiles")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return (data ?? []) as unknown as AircraftProfile[];
}

export async function findAircraftByRegistration(reg: string): Promise<AircraftProfile | null> {
  const norm = normalizeRegistration(reg);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("aircraft_profiles")
    .select("*")
    .eq("user_id", user.id)
    .eq("normalized_registration", norm)
    .maybeSingle();
  if (error) { console.error(error); return null; }
  return (data as unknown as AircraftProfile) ?? null;
}

export async function upsertAircraftProfile(input: {
  registration: string;
  model?: string | null;
  manufacturer?: string | null;
  aircraft_type_code?: string | null;
  icao24?: string | null;
  serial_number?: string | null;
  operator_name?: string | null;
  remarks?: string | null;
  lookup_source?: string | null;
  lookup_status?: string | null;
  is_manual_override?: boolean;
}): Promise<AircraftProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const norm = normalizeRegistration(input.registration);
  const { data, error } = await supabase
    .from("aircraft_profiles")
    .upsert({
      user_id: user.id,
      registration: input.registration,
      normalized_registration: norm,
      model: input.model ?? null,
      manufacturer: input.manufacturer ?? null,
      aircraft_type_code: input.aircraft_type_code ?? null,
      icao24: input.icao24 ?? null,
      serial_number: input.serial_number ?? null,
      operator_name: input.operator_name ?? null,
      remarks: input.remarks ?? null,
      lookup_source: input.lookup_source ?? null,
      lookup_status: input.lookup_status ?? null,
      lookup_timestamp: new Date().toISOString(),
      is_manual_override: input.is_manual_override ?? false,
    }, { onConflict: "user_id,normalized_registration" })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as AircraftProfile;
}

// ============ MAINTENANCE LOGS ============

function rowToLog(r: any): LogEntry {
  return {
    id: r.id,
    aircraft_profile_id: r.aircraft_profile_id,
    registration: r.registration ?? "",
    aircraft_model: r.aircraft_model ?? "",
    manufacturer: r.manufacturer ?? "",
    ata_chapter: r.ata_chapter ?? "",
    fault_description: r.fault_description ?? "",
    symptoms: r.symptoms ?? [],
    root_cause: r.root_cause ?? "",
    action_taken: r.action_taken ?? "",
    tools_used: r.tools_used ?? "",
    time_spent_hours: Number(r.time_spent_hours ?? 0),
    is_recurring: !!r.is_recurring,
    image_urls: r.image_urls ?? [],
    voice_note_url: r.voice_note_url ?? null,
    created_at: r.created_at,
    system_component: r.system_component ?? "",
    maintenance_reference: r.maintenance_reference ?? "",
    share_to_community: r.share_to_community ?? true,
    visibility: (r.visibility as LogVisibility) ?? "personal",
    organization_id: r.organization_id ?? null,
  };
}

function toLocal(r: LogEntry, sync: "synced" | "pending" | "failed" = "synced"): LocalLog {
  return { ...r, updated_at: new Date().toISOString(), _sync: sync };
}

export async function fetchLogs(): Promise<LogEntry[]> {
  if (isOnline()) {
    const { data, error } = await supabase
      .from("maintenance_logs")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      const rows = data.map(rowToLog);
      try { await bulkPutServerLogs(rows.map((r) => toLocal(r))); } catch { /* idb may be unavailable */ }
      // Merge in any pending local-only rows
      try {
        const local = await getLocalLogs();
        const ids = new Set(rows.map((r) => r.id));
        for (const l of local) if (!ids.has(l.id)) rows.push(l);
        rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      } catch { /* ignore */ }
      return rows;
    }
    if (error) console.error(error);
  }
  // Offline (or fetch failed) — read from local mirror
  try { return await getLocalLogs(); } catch { return []; }
}

export async function fetchRecentLogs(limit = 5): Promise<LogEntry[]> {
  const all = await fetchLogs();
  return all.slice(0, limit);
}

export async function fetchLog(id: string): Promise<LogEntry | null> {
  if (isOnline()) {
    const { data, error } = await supabase
      .from("maintenance_logs").select("*").eq("id", id).maybeSingle();
    if (!error && data) {
      const row = rowToLog(data);
      try { await putLocalLog(toLocal(row)); } catch { /* ignore */ }
      return row;
    }
  }
  try {
    const local = await getLocalLog(id);
    return local ?? null;
  } catch { return null; }
}

export type LogInput = Omit<LogEntry, "id" | "created_at"> & { created_at?: string | null };

function buildPayload(input: LogInput) {
  return {
    aircraft_profile_id: input.aircraft_profile_id,
    registration: input.registration,
    aircraft_model: input.aircraft_model,
    manufacturer: input.manufacturer,
    ata_chapter: input.ata_chapter,
    fault_description: input.fault_description,
    symptoms: input.symptoms,
    root_cause: input.root_cause,
    action_taken: input.action_taken,
    tools_used: input.tools_used,
    time_spent_hours: input.time_spent_hours,
    is_recurring: input.is_recurring,
    image_urls: input.image_urls,
    voice_note_url: input.voice_note_url,
    system_component: input.system_component ?? null,
    maintenance_reference: input.maintenance_reference ?? null,
    share_to_community: input.share_to_community ?? true,
    visibility: input.visibility ?? "personal",
    organization_id: input.organization_id ?? null,
    ...(input.created_at ? { created_at: input.created_at } : {}),
  };
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "local-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function saveLog(input: LogInput): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } } as any));
  const payload = buildPayload(input);

  if (isOnline() && user) {
    const { error } = await supabase.from("maintenance_logs").insert({ user_id: user.id, ...payload });
    if (!error) { drainQueue(); return; }
    // fall through to offline queue on error
    console.error(error);
  }
  // Offline path
  const id = genId();
  const local: LocalLog = {
    id,
    aircraft_profile_id: input.aircraft_profile_id ?? null,
    registration: input.registration,
    aircraft_model: input.aircraft_model,
    manufacturer: input.manufacturer,
    ata_chapter: input.ata_chapter,
    fault_description: input.fault_description,
    symptoms: input.symptoms,
    root_cause: input.root_cause,
    action_taken: input.action_taken,
    tools_used: input.tools_used,
    time_spent_hours: input.time_spent_hours,
    is_recurring: input.is_recurring,
    image_urls: input.image_urls ?? [],
    voice_note_url: input.voice_note_url ?? null,
    created_at: input.created_at ?? new Date().toISOString(),
    system_component: input.system_component ?? "",
    maintenance_reference: input.maintenance_reference ?? "",
    share_to_community: input.share_to_community ?? true,
    visibility: input.visibility ?? "personal",
    organization_id: input.organization_id ?? null,
    updated_at: new Date().toISOString(),
    _sync: "pending",
  };
  await putLocalLog(local);
  await enqueue({ op: "create", logId: id, payload });
}

export async function updateLog(id: string, input: LogInput): Promise<void> {
  const payload = buildPayload(input);
  if (isOnline()) {
    const { error } = await supabase.from("maintenance_logs").update(payload).eq("id", id);
    if (!error) {
      try {
        const existing = await getLocalLog(id);
        if (existing) await putLocalLog({ ...existing, ...payload, _sync: "synced", updated_at: new Date().toISOString() } as LocalLog);
      } catch { /* ignore */ }
      drainQueue();
      return;
    }
    console.error(error);
  }
  const existing = await getLocalLog(id);
  const merged: LocalLog = {
    ...(existing as LocalLog),
    ...payload,
    id,
    created_at: existing?.created_at ?? input.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _sync: "pending",
  } as LocalLog;
  await putLocalLog(merged);
  await enqueue({ op: "update", logId: id, payload });
}

export async function deleteLog(id: string): Promise<void> {
  if (isOnline()) {
    const { error } = await supabase.from("maintenance_logs").delete().eq("id", id);
    if (!error) {
      try { await deleteLogLocal(id); } catch { /* ignore */ }
      drainQueue();
      return;
    }
    console.error(error);
  }
  await deleteLogLocal(id);
  await enqueue({ op: "delete", logId: id });
}

export async function searchLogs(query: string): Promise<LogEntry[]> {
  const q = query.trim();
  if (!q) return [];
  // Use Postgres OR with ilike — simple but effective for MVP.
  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const { data, error } = await supabase
    .from("maintenance_logs")
    .select("*")
    .or(`fault_description.ilike.${like},aircraft_model.ilike.${like},registration.ilike.${like},ata_chapter.ilike.${like},action_taken.ilike.${like},root_cause.ilike.${like}`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) { console.error(error); return []; }
  return (data ?? []).map(rowToLog);
}

// ============ STATS ============

export interface Stats {
  totalLogs: number;
  aircraftTypes: number;
  totalHours: number;
  ataChapters: number;
}

export async function computeStats(): Promise<Stats> {
  const logs = await fetchLogs();
  const aircraftTypes = new Set(logs.map((l) => l.aircraft_model).filter(Boolean));
  const totalHours = logs.reduce((s, l) => s + l.time_spent_hours, 0);
  const ata = new Set(logs.map((l) => l.ata_chapter.split(" ")[0]).filter(Boolean));
  return {
    totalLogs: logs.length,
    aircraftTypes: aircraftTypes.size,
    totalHours: Math.round(totalHours * 10) / 10,
    ataChapters: ata.size,
  };
}

export async function computeExperience(): Promise<{
  byAircraft: Record<string, { hours: number; jobs: number }>;
  byAta: Record<string, number>;
  totalJobs: number;
}> {
  const logs = await fetchLogs();
  const byAircraft: Record<string, { hours: number; jobs: number }> = {};
  const byAta: Record<string, number> = {};
  for (const l of logs) {
    const key = l.aircraft_model || "Unknown";
    if (!byAircraft[key]) byAircraft[key] = { hours: 0, jobs: 0 };
    byAircraft[key].hours += l.time_spent_hours;
    byAircraft[key].jobs += 1;
    const ata = l.ata_chapter.split(" ")[0];
    if (ata) byAta[ata] = (byAta[ata] || 0) + 1;
  }
  return { byAircraft, byAta, totalJobs: logs.length };
}

/** Format decimal hours as "Xh Ym" (e.g. 1.5 -> "1h 30m"). */
export function formatHoursMinutes(hours: number): string {
  if (!hours || hours <= 0) return "0h 0m";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 60) return `${h + 1}h 0m`;
  return `${h}h ${m}m`;
}

// ============ CONSTANTS ============

export interface MaintenanceTemplate {
  label: string;
  ata_chapter: string;
  fault_description: string;
  action_taken: string;
  time_hours: string;
}

export const MAINTENANCE_TEMPLATES: MaintenanceTemplate[] = [
  {
    label: "100-Hour Inspection",
    ata_chapter: "05 – Time Limits",
    fault_description: "Scheduled 100-hour maintenance inspection",
    action_taken: "Completed 100-hour inspection per AMM. Checked all systems, lubrication, filters, and control surfaces. No defects found.",
    time_hours: "8",
  },
  {
    label: "Oil & Filter Change",
    ata_chapter: "79 – Engine Oil",
    fault_description: "Scheduled engine oil and filter replacement",
    action_taken: "Drained engine oil, replaced oil filter, refilled with approved oil to correct level. Checked for leaks.",
    time_hours: "1",
  },
  {
    label: "Spark Plug Replacement",
    ata_chapter: "74 – Ignition",
    fault_description: "Scheduled spark plug replacement due to service interval",
    action_taken: "Removed and inspected old spark plugs. Installed new approved spark plugs, torqued to spec. Performed engine run-up.",
    time_hours: "3",
  },
  {
    label: "Brake System Check",
    ata_chapter: "32 – Landing Gear",
    fault_description: "Scheduled brake system inspection and fluid check",
    action_taken: "Inspected brake pads, discs, and hydraulic lines. Checked brake fluid level. No wear or leaks found.",
    time_hours: "2",
  },
  {
    label: "Pitot-Static System Check",
    ata_chapter: "34 – Navigation",
    fault_description: "Scheduled pitot-static system inspection and leak test",
    action_taken: "Performed pitot-static leak test per AMM. Checked all connections and pitot heater operation. System within limits.",
    time_hours: "2",
  },
  {
    label: "Annual Battery Inspection",
    ata_chapter: "24 – Electrical Power",
    fault_description: "Annual aircraft battery inspection and capacity test",
    action_taken: "Inspected battery terminals and case. Performed capacity test. Battery within limits. Cleaned and re-installed.",
    time_hours: "1",
  },
  {
    label: "Flight Control Rigging Check",
    ata_chapter: "27 – Flight Controls",
    fault_description: "Scheduled flight control rigging and range-of-motion check",
    action_taken: "Checked all primary and secondary flight control ranges per AMM. Adjusted cable tensions. Full and free movement confirmed.",
    time_hours: "4",
  },
  {
    label: "Engine Ground Run / Power Check",
    ata_chapter: "71 – Powerplant",
    fault_description: "Post-maintenance engine ground run to verify normal operation",
    action_taken: "Performed engine run-up. Checked all engine parameters within limits. No abnormal vibration, temps, or pressures.",
    time_hours: "1",
  },
];

export const ATA_CHAPTERS = [
  "05 – Time Limits", "06 – Dimensions & Areas", "07 – Lifting & Shoring",
  "08 – Leveling & Weighing", "09 – Towing & Taxiing", "10 – Parking & Mooring",
  "11 – Placards & Markings", "12 – Servicing", "20 – Standard Practices",
  "21 – Air Conditioning", "22 – Auto Flight", "23 – Communications",
  "24 – Electrical Power", "25 – Equipment/Furnishings", "26 – Fire Protection",
  "27 – Flight Controls", "28 – Fuel", "29 – Hydraulic Power",
  "30 – Ice/Rain Protection", "31 – Instruments", "32 – Landing Gear",
  "33 – Lights", "34 – Navigation", "35 – Oxygen", "36 – Pneumatic",
  "38 – Water/Waste", "49 – APU", "52 – Doors", "53 – Fuselage",
  "54 – Nacelles/Pylons", "55 – Stabilizers", "56 – Windows", "57 – Wings",
  "71 – Powerplant", "72 – Engine", "73 – Engine Fuel", "74 – Ignition",
  "75 – Engine Bleed Air", "76 – Engine Controls", "77 – Engine Indicating",
  "78 – Engine Exhaust", "79 – Engine Oil", "80 – Starting",
];
