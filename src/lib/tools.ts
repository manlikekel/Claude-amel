/**
 * Tool calibration register.
 */
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";

export type ToolStatus = "in_service" | "due" | "overdue" | "out_of_service";

export interface CalibratedTool {
  id: string;
  user_id: string;
  tool_id: string;
  tool_name: string;
  manufacturer: string;
  serial_number: string;
  category: string;
  last_cal_date: string | null;
  next_cal_date: string;
  cal_interval_months: number;
  cal_certificate_url: string;
  status: ToolStatus;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export type ToolInput = Omit<CalibratedTool, "id" | "user_id" | "created_at" | "updated_at" | "status">;

export function deriveStatus(t: { next_cal_date: string }): ToolStatus {
  try {
    const days = differenceInDays(new Date(t.next_cal_date), new Date());
    if (days < 0) return "overdue";
    if (days <= 30) return "due";
    return "in_service";
  } catch { return "in_service"; }
}

export async function fetchTools(): Promise<CalibratedTool[]> {
  const { data, error } = await supabase
    .from("tool_calibration")
    .select("*")
    .order("next_cal_date", { ascending: true });
  if (error) { console.error(error); return []; }
  return (data ?? []) as unknown as CalibratedTool[];
}

export async function saveTool(input: ToolInput): Promise<CalibratedTool> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const status = deriveStatus({ next_cal_date: input.next_cal_date });
  const { data, error } = await supabase
    .from("tool_calibration")
    .insert({ ...input, user_id: user.id, status })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CalibratedTool;
}

export async function updateTool(id: string, input: Partial<ToolInput>): Promise<void> {
  const patch: any = { ...input };
  if (input.next_cal_date) patch.status = deriveStatus({ next_cal_date: input.next_cal_date });
  const { error } = await supabase.from("tool_calibration").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTool(id: string): Promise<void> {
  const { error } = await supabase.from("tool_calibration").delete().eq("id", id);
  if (error) throw error;
}
