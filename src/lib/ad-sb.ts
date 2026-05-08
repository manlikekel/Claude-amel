/**
 * Airworthiness Directives (AD) and Service Bulletins (SB) compliance.
 */
import { supabase } from "@/integrations/supabase/client";

export type ADSBType = "AD" | "SB" | "STC";
export type ADSBStatus = "open" | "complied" | "not_applicable" | "superseded";

export interface ADSBItem {
  id: string;
  user_id: string;
  aircraft_profile_id: string | null;
  reference_type: ADSBType;
  reference_number: string;
  issuing_authority: string;
  title: string;
  effective_date: string | null;
  compliance_date: string | null;
  next_due_date: string | null;
  recurring_interval_hours: number | null;
  recurring_interval_cycles: number | null;
  status: ADSBStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type ADSBInput = Omit<ADSBItem, "id" | "user_id" | "created_at" | "updated_at">;

export async function fetchADSB(): Promise<ADSBItem[]> {
  const { data, error } = await supabase
    .from("ad_sb_compliance")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return (data ?? []) as unknown as ADSBItem[];
}

export async function fetchOpenADSB(): Promise<ADSBItem[]> {
  const { data, error } = await supabase
    .from("ad_sb_compliance")
    .select("*")
    .eq("status", "open")
    .order("next_due_date", { ascending: true, nullsFirst: false });
  if (error) { console.error(error); return []; }
  return (data ?? []) as unknown as ADSBItem[];
}

export async function saveADSB(input: ADSBInput): Promise<ADSBItem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("ad_sb_compliance")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ADSBItem;
}

export async function updateADSB(id: string, input: Partial<ADSBInput>): Promise<void> {
  const { error } = await supabase.from("ad_sb_compliance").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteADSB(id: string): Promise<void> {
  const { error } = await supabase.from("ad_sb_compliance").delete().eq("id", id);
  if (error) throw error;
}
