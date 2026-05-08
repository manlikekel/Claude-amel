/**
 * Audit log — writes high-value events for compliance and forensics.
 * RLS allows users to read their own events; org owners/admins can read
 * everything for their org.
 */
import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "log.create" | "log.update" | "log.delete" | "log.sign" | "log.cosign_request"
  | "component.create" | "component.update" | "component.delete"
  | "adsb.create" | "adsb.update" | "adsb.complied"
  | "tool.create" | "tool.calibrated"
  | "cpd.create"
  | "type_rating.create"
  | "profile.verification_requested" | "profile.verification_approved" | "profile.deleted"
  | "data.exported"
  | "vote.cast"
  | "concurrence.cast";

export interface AuditEvent {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export async function recordAudit(action: AuditAction, opts: {
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  organization_id?: string | null;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert({
      user_id: user?.id ?? null,
      organization_id: opts.organization_id ?? null,
      action,
      resource_type: opts.resource_type ?? null,
      resource_id: opts.resource_id ?? null,
      metadata: opts.metadata ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch (e) {
    // Non-fatal — never let audit logging break the user flow
    console.warn("audit failed:", e);
  }
}

export async function fetchMyAuditLog(limit = 100): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.error(error); return []; }
  return (data ?? []) as unknown as AuditEvent[];
}
