/**
 * Sync engine — drains queued offline mutations to Supabase when online.
 * Emits status events to the small online/offline pill.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  getMutations, deleteMutation, updateMutation,
  putLog, getLog, pendingCount,
} from "./offline-db";
import { toast } from "sonner";

type SyncListener = (state: { online: boolean; pending: number; syncing: boolean }) => void;
const listeners = new Set<SyncListener>();
let syncing = false;

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function subscribeSyncStatus(fn: SyncListener): () => void {
  listeners.add(fn);
  emit();
  return () => { listeners.delete(fn); };
}

async function emit() {
  const pending = await pendingCount().catch(() => 0);
  for (const fn of listeners) fn({ online: isOnline(), pending, syncing });
}

const TABLE = "maintenance_logs" as const;

function logPayload(p: any) {
  // Strip local-only keys
  const { _sync, _deleted, updated_at: _u, created_at, ...rest } = p ?? {};
  return { ...rest, ...(created_at ? { created_at } : {}) };
}

export async function drainQueue(): Promise<{ ok: number; failed: number }> {
  if (syncing || !isOnline()) return { ok: 0, failed: 0 };
  syncing = true; emit();
  let ok = 0, failed = 0;
  try {
    const mutations = await getMutations();
    mutations.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { syncing = false; emit(); return { ok: 0, failed: 0 }; }

    for (const m of mutations) {
      try {
        if (m.op === "create") {
          const { error } = await supabase.from(TABLE).insert({
            ...logPayload(m.payload),
            id: m.logId,
            user_id: user.id,
          });
          if (error && !/duplicate key/i.test(error.message)) throw error;
        } else if (m.op === "update") {
          const { error } = await supabase.from(TABLE)
            .update(logPayload(m.payload))
            .eq("id", m.logId);
          if (error) throw error;
        } else if (m.op === "delete") {
          const { error } = await supabase.from(TABLE).delete().eq("id", m.logId);
          if (error) throw error;
        }
        await deleteMutation(m.id!);
        // Mark local row as synced
        const local = await getLog(m.logId);
        if (local && m.op !== "delete") {
          await putLog({ ...local, _sync: "synced", updated_at: new Date().toISOString() });
        }
        ok++;
      } catch (e: any) {
        failed++;
        await updateMutation({
          ...m,
          attempts: (m.attempts ?? 0) + 1,
          lastError: String(e?.message ?? e),
        });
        const local = await getLog(m.logId);
        if (local) await putLog({ ...local, _sync: "failed" });
      }
    }
  } finally {
    syncing = false;
    emit();
  }
  return { ok, failed };
}

let installed = false;
export function installSyncListeners() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  let wasOffline = !isOnline();
  window.addEventListener("online", async () => {
    emit();
    if (wasOffline) {
      const pend = await pendingCount();
      if (pend > 0) toast.info("Back online. Syncing your data…");
      const { ok, failed } = await drainQueue();
      if (ok > 0 && failed === 0) toast.success("All offline changes synced successfully.");
      else if (failed > 0) toast.error("Some changes could not sync. We will retry automatically.");
    }
    wasOffline = false;
  });
  window.addEventListener("offline", () => {
    wasOffline = true;
    emit();
  });

  // Periodic retry when online (every 60s)
  setInterval(() => {
    if (isOnline()) drainQueue();
  }, 60_000);

  // Initial drain
  if (isOnline()) drainQueue();
}
