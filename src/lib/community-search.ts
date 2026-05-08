/**
 * Anonymized global community fault library access.
 * RLS allows any authenticated user to SELECT approved entries.
 */

import { supabase } from "@/integrations/supabase/client";
import type { CommunityEntry } from "./search-engine";

export async function fetchVoteCounts(faultIds: string[]): Promise<Record<string, number>> {
  if (faultIds.length === 0) return {};
  const { data, error } = await supabase
    .from("fault_votes")
    .select("fault_id")
    .in("fault_id", faultIds);
  if (error) { console.error("vote fetch:", error); return {}; }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.fault_id] = (counts[row.fault_id] || 0) + 1;
  }
  return counts;
}

export async function fetchMyVotes(faultIds: string[]): Promise<Set<string>> {
  if (faultIds.length === 0) return new Set();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data, error } = await supabase
    .from("fault_votes")
    .select("fault_id")
    .in("fault_id", faultIds)
    .eq("user_id", user.id);
  if (error) { console.error("my votes fetch:", error); return new Set(); }
  return new Set((data ?? []).map((r) => r.fault_id));
}

export async function toggleVote(faultId: string, currentlyVoted: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  if (currentlyVoted) {
    await supabase.from("fault_votes").delete().eq("fault_id", faultId).eq("user_id", user.id);
  } else {
    await supabase.from("fault_votes").insert({ fault_id: faultId, user_id: user.id });
  }
}

export async function fetchCommunityCandidates(opts: {
  query: string;
  aircraftModel?: string;
  ataChapter?: string; // free-form like "21" or "21 – Air Conditioning"
  limit?: number;
}): Promise<CommunityEntry[]> {
  const { query, aircraftModel, ataChapter, limit = 80 } = opts;
  const q = query.trim();
  let req = supabase
    .from("community_fault_library")
    .select(
      "id,source_log_id,aircraft_model,manufacturer,ata_chapter,fault_description,action_taken,root_cause,system_component,maintenance_reference,country_region,created_at",
    )
    .eq("approved_for_global_search", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (aircraftModel) req = req.ilike("aircraft_model", aircraftModel);
  if (ataChapter) req = req.ilike("ata_chapter", `%${ataChapter}%`);

  if (q.length > 1) {
    const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    req = req.or(
      `fault_description.ilike.${like},action_taken.ilike.${like},root_cause.ilike.${like},system_component.ilike.${like}`,
    );
  }

  const { data, error } = await req;
  if (error) {
    console.error("community search:", error);
    return [];
  }
  return (data ?? []) as CommunityEntry[];
}
