/**
 * GDPR / CCPA compliant data export.
 *
 * Pulls every row the signed-in user owns across every domain table and packages
 * it as a single JSON document. Works entirely client-side over RLS so we never
 * leak other users' rows.
 */
import { supabase } from "@/integrations/supabase/client";
import { recordAudit } from "./audit";

export interface FullDataExport {
  exported_at: string;
  schema_version: 1;
  user: { id: string; email: string };
  profile: any;
  licences: any[];
  aircraft_profiles: any[];
  maintenance_logs: any[];
  log_signatures: any[];
  components: any[];
  ad_sb_compliance: any[];
  tool_calibration: any[];
  cpd_records: any[];
  type_ratings: any[];
  fault_votes: any[];
  fault_concurrences: any[];
  job_postings: any[];
  audit_log: any[];
}

const TABLES = [
  "profiles", "licences", "aircraft_profiles", "maintenance_logs", "log_signatures",
  "components", "ad_sb_compliance", "tool_calibration", "cpd_records", "type_ratings",
  "fault_votes", "fault_concurrences", "job_postings", "audit_log",
] as const;

export async function exportAllUserData(): Promise<FullDataExport> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const all: Record<string, any> = {};
  await Promise.all(
    TABLES.map(async (t) => {
      const { data } = await supabase.from(t).select("*");
      all[t] = data ?? [];
    }),
  );

  await recordAudit("data.exported", { resource_type: "profile", resource_id: user.id });

  return {
    exported_at: new Date().toISOString(),
    schema_version: 1,
    user: { id: user.id, email: user.email ?? "" },
    profile: all.profiles?.[0] ?? null,
    licences: all.licences ?? [],
    aircraft_profiles: all.aircraft_profiles ?? [],
    maintenance_logs: all.maintenance_logs ?? [],
    log_signatures: all.log_signatures ?? [],
    components: all.components ?? [],
    ad_sb_compliance: all.ad_sb_compliance ?? [],
    tool_calibration: all.tool_calibration ?? [],
    cpd_records: all.cpd_records ?? [],
    type_ratings: all.type_ratings ?? [],
    fault_votes: all.fault_votes ?? [],
    fault_concurrences: all.fault_concurrences ?? [],
    job_postings: all.job_postings ?? [],
    audit_log: all.audit_log ?? [],
  };
}

export async function downloadUserDataJson(): Promise<void> {
  const data = await exportAllUserData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `amel-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Delete the signed-in user's account.
 * Caveat: full account deletion (auth.users row) requires a service-role
 * function on the backend — this only wipes profile/log data through RLS.
 */
export async function deleteAllUserData(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  // Cascade deletes are configured on every FK to auth.users — but we still
  // explicitly clear the user-owned rows here so data is gone immediately.
  for (const t of TABLES) {
    if (t === "profiles" || t === "audit_log") continue;
    await supabase.from(t).delete().eq("user_id", user.id);
  }
  await recordAudit("profile.deleted", { resource_type: "profile", resource_id: user.id });
  await supabase.auth.signOut();
}
