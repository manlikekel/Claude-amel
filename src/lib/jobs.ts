/**
 * Job board — maintenance opportunities posted by operators / MROs.
 */
import { supabase } from "@/integrations/supabase/client";

export type JobType = "full_time" | "contract" | "line_check" | "base_check";
export type JobStatus = "open" | "filled" | "closed";

export interface JobPosting {
  id: string;
  posted_by: string;
  organization_id: string | null;
  title: string;
  company: string;
  location: string;
  country: string;
  job_type: JobType;
  required_authority: string;
  required_categories: string[];
  required_aircraft: string[];
  description: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  contact_email: string;
  contact_url: string;
  status: JobStatus;
  posted_at: string;
  expires_at: string;
}

export type JobInput = Omit<JobPosting, "id" | "posted_by" | "posted_at" | "expires_at" | "status">;

export async function fetchJobs(filters?: { country?: string; jobType?: JobType; authority?: string }): Promise<JobPosting[]> {
  let req = supabase
    .from("job_postings")
    .select("*")
    .eq("status", "open")
    .order("posted_at", { ascending: false });
  if (filters?.country) req = req.eq("country", filters.country);
  if (filters?.jobType) req = req.eq("job_type", filters.jobType);
  if (filters?.authority) req = req.eq("required_authority", filters.authority);
  const { data, error } = await req;
  if (error) { console.error(error); return []; }
  return (data ?? []) as unknown as JobPosting[];
}

export async function postJob(input: JobInput): Promise<JobPosting> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("job_postings")
    .insert({ ...input, posted_by: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as JobPosting;
}

export async function closeJob(id: string): Promise<void> {
  const { error } = await supabase.from("job_postings").update({ status: "closed" }).eq("id", id);
  if (error) throw error;
}

export async function fetchMyJobs(): Promise<JobPosting[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("job_postings")
    .select("*")
    .eq("posted_by", user.id)
    .order("posted_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return (data ?? []) as unknown as JobPosting[];
}
