/**
 * Cloud-backed data access layer for AMEL.
 *
 * All persistence is via Lovable Cloud (Supabase). RLS scopes everything
 * to the signed-in user automatically. No localStorage fallback — this app
 * is online-first; an unsigned-in user is gated to the auth screen.
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizeRegistration } from "./aircraft";

// ============ TYPES (mirror Supabase rows but flattened for UI) ============

export interface ProfileData {
  name: string;
  email: string;
  phone: string;
  ame_licence_no: string;
  address: string;
  share_to_community_default?: boolean;
  country_region?: string;
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
};

export async function fetchProfile(): Promise<ProfileData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY_PROFILE;
  const { data, error } = await supabase
    .from("profiles")
    .select("name,email,phone,ame_licence_no,address,share_to_community_default,country_region")
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
  };
}

export async function fetchLogs(): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from("maintenance_logs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return (data ?? []).map(rowToLog);
}

export async function fetchRecentLogs(limit = 5): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from("maintenance_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.error(error); return []; }
  return (data ?? []).map(rowToLog);
}

export async function fetchLog(id: string): Promise<LogEntry | null> {
  const { data, error } = await supabase
    .from("maintenance_logs").select("*").eq("id", id).maybeSingle();
  if (error) { console.error(error); return null; }
  return data ? rowToLog(data) : null;
}

export type LogInput = Omit<LogEntry, "id" | "created_at"> & { created_at?: string | null };

export async function saveLog(input: LogInput): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase.from("maintenance_logs").insert({
    user_id: user.id,
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
    ...(input.created_at ? { created_at: input.created_at } : {}),
  });
  if (error) throw error;
}

export async function updateLog(id: string, input: LogInput): Promise<void> {
  const { error } = await supabase.from("maintenance_logs").update({
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
    ...(input.created_at ? { created_at: input.created_at } : {}),
  }).eq("id", id);
  if (error) throw error;
}

export async function deleteLog(id: string): Promise<void> {
  const { error } = await supabase.from("maintenance_logs").delete().eq("id", id);
  if (error) throw error;
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

// ============ CONSTANTS ============

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
