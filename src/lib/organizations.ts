/**
 * Team / company workspace data layer.
 * Schema is in place but UI is intentionally minimal — we only expose
 * create / join / list / set-active so users can experiment with team mode.
 */
import { supabase } from "@/integrations/supabase/client";

export type OrgRole = "owner" | "admin" | "member";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
}

export interface OrganizationMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  organizations?: Organization | null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || `team-${Date.now()}`;
}

export async function fetchMyOrganizations(): Promise<OrganizationMembership[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, organizations(*)")
    .eq("user_id", user.id);
  if (error) { console.error(error); return []; }
  return (data ?? []) as unknown as OrganizationMembership[];
}

export async function createOrganization(name: string): Promise<Organization> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  let slug = slugify(trimmed);

  // Best-effort uniqueness — append suffix if collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name: trimmed, slug, created_by: user.id })
      .select()
      .single();
    if (!error && data) return data as Organization;
    if (error && !String(error.message).toLowerCase().includes("duplicate")) throw error;
    slug = `${slugify(trimmed)}-${Math.floor(Math.random() * 9999)}`;
  }
  throw new Error("Couldn't create organization (slug conflict)");
}

export async function joinOrganizationBySlug(slug: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const cleaned = slugify(slug);
  const { data: org, error: e1 } = await supabase
    .from("organizations").select("id").eq("slug", cleaned).maybeSingle();
  if (e1) throw e1;
  if (!org) throw new Error("No team found with that ID");
  const { error: e2 } = await supabase
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: user.id, role: "member" });
  if (e2 && !String(e2.message).toLowerCase().includes("duplicate")) throw e2;
}

export async function leaveOrganization(orgId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function setActiveOrganization(orgId: string | null): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("profiles")
    .update({ active_organization_id: orgId })
    .eq("user_id", user.id);
  if (error) throw error;
}
