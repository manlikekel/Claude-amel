/**
 * Continuing Professional Development (CPD) records.
 * EASA Part-66 requires recurrent training; many other authorities have
 * similar requirements (CAAC, GCAA, DGCA).
 */
import { supabase } from "@/integrations/supabase/client";

export interface CPDRecord {
  id: string;
  user_id: string;
  course_title: string;
  provider: string;
  category: string;
  start_date: string | null;
  end_date: string | null;
  hours: number;
  certificate_url: string;
  certificate_no: string;
  framework: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type CPDInput = Omit<CPDRecord, "id" | "user_id" | "created_at" | "updated_at">;

export const CPD_CATEGORIES = [
  "type",
  "regulatory",
  "human_factors",
  "fuel_tank_safety",
  "edto",
  "safety_management",
  "ageing_aircraft",
  "language",
  "other",
] as const;

export async function fetchCPD(): Promise<CPDRecord[]> {
  const { data, error } = await supabase
    .from("cpd_records")
    .select("*")
    .order("end_date", { ascending: false, nullsFirst: false });
  if (error) { console.error(error); return []; }
  return (data ?? []) as unknown as CPDRecord[];
}

export async function saveCPD(input: CPDInput): Promise<CPDRecord> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("cpd_records")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CPDRecord;
}

export async function updateCPD(id: string, input: Partial<CPDInput>): Promise<void> {
  const { error } = await supabase.from("cpd_records").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteCPD(id: string): Promise<void> {
  const { error } = await supabase.from("cpd_records").delete().eq("id", id);
  if (error) throw error;
}

export function totalHoursLast24Months(records: CPDRecord[]): number {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 24);
  return records
    .filter((r) => r.end_date && new Date(r.end_date) >= cutoff)
    .reduce((s, r) => s + (r.hours || 0), 0);
}
