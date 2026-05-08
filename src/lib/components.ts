/**
 * Aircraft components register — TSN/TSO/cycle tracking.
 */
import { supabase } from "@/integrations/supabase/client";

export interface Component {
  id: string;
  user_id: string;
  aircraft_profile_id: string | null;
  ata_chapter: string;
  part_number: string;
  serial_number: string;
  description: string;
  installed_date: string | null;
  removed_date: string | null;
  tsn_hours: number;
  tso_hours: number;
  cycles_total: number;
  cycles_since_overhaul: number;
  hard_time_limit: number | null;
  status: "installed" | "removed" | "scrapped";
  remarks: string;
  created_at: string;
  updated_at: string;
}

export type ComponentInput = Omit<Component, "id" | "user_id" | "created_at" | "updated_at">;

export async function fetchComponents(): Promise<Component[]> {
  const { data, error } = await supabase
    .from("components")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return (data ?? []) as unknown as Component[];
}

export async function fetchComponentsForAircraft(aircraftProfileId: string): Promise<Component[]> {
  const { data, error } = await supabase
    .from("components")
    .select("*")
    .eq("aircraft_profile_id", aircraftProfileId)
    .order("description");
  if (error) { console.error(error); return []; }
  return (data ?? []) as unknown as Component[];
}

export async function saveComponent(input: ComponentInput): Promise<Component> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("components")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Component;
}

export async function updateComponent(id: string, input: Partial<ComponentInput>): Promise<void> {
  const { error } = await supabase.from("components").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteComponent(id: string): Promise<void> {
  const { error } = await supabase.from("components").delete().eq("id", id);
  if (error) throw error;
}

export function timeRemaining(c: Component): { hours: number | null; pct: number | null } {
  if (c.hard_time_limit == null) return { hours: null, pct: null };
  const used = c.tso_hours;
  const remaining = Math.max(0, c.hard_time_limit - used);
  const pct = Math.min(100, Math.max(0, (used / c.hard_time_limit) * 100));
  return { hours: remaining, pct };
}
