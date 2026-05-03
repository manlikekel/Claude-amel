/**
 * Offline-first IndexedDB layer for AMEL.
 *
 * Stores:
 *  - `logs`        — local mirror of maintenance_logs (with _sync flag)
 *  - `mutations`   — queued create/update/delete ops to flush when online
 *  - `meta`        — misc cache (profile, last-sync timestamps)
 *
 * Conflict strategy: last-write-wins by `updated_at` (server vs local).
 */
import { openDB, type IDBPDatabase } from "idb";
import type { LogEntry } from "./data";

export type SyncStatus = "synced" | "pending" | "failed";

export interface LocalLog extends LogEntry {
  updated_at: string;
  _sync: SyncStatus;
  _deleted?: boolean;
}

export type MutationOp = "create" | "update" | "delete";

export interface QueuedMutation {
  id?: number;
  op: MutationOp;
  logId: string;
  payload?: any;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

const DB_NAME = "amel-offline";
const DB_VERSION = 1;

let _db: Promise<IDBPDatabase> | null = null;
function db() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  if (!_db) {
    _db = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("logs")) {
          const s = d.createObjectStore("logs", { keyPath: "id" });
          s.createIndex("by_sync", "_sync");
          s.createIndex("by_created", "created_at");
        }
        if (!d.objectStoreNames.contains("mutations")) {
          d.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
        }
        if (!d.objectStoreNames.contains("meta")) {
          d.createObjectStore("meta");
        }
      },
    });
  }
  return _db;
}

export async function putLog(log: LocalLog): Promise<void> {
  const d = await db();
  await d.put("logs", log);
}

export async function bulkPutServerLogs(logs: LocalLog[]): Promise<void> {
  const d = await db();
  const tx = d.transaction("logs", "readwrite");
  for (const incoming of logs) {
    const existing = (await tx.store.get(incoming.id)) as LocalLog | undefined;
    // Last-write-wins: keep local if it's pending or has newer updated_at
    if (existing && existing._sync !== "synced") continue;
    if (existing && existing.updated_at && incoming.updated_at &&
        new Date(existing.updated_at) > new Date(incoming.updated_at)) continue;
    await tx.store.put(incoming);
  }
  await tx.done;
}

export async function getAllLogs(): Promise<LocalLog[]> {
  const d = await db();
  const all = (await d.getAll("logs")) as LocalLog[];
  return all.filter((l) => !l._deleted).sort((a, b) =>
    +new Date(b.created_at) - +new Date(a.created_at)
  );
}

export async function getLog(id: string): Promise<LocalLog | undefined> {
  const d = await db();
  return (await d.get("logs", id)) as LocalLog | undefined;
}

export async function deleteLogLocal(id: string): Promise<void> {
  const d = await db();
  await d.delete("logs", id);
}

export async function enqueue(m: Omit<QueuedMutation, "id" | "attempts" | "createdAt"> & { attempts?: number; createdAt?: string }): Promise<void> {
  const d = await db();
  await d.add("mutations", {
    ...m,
    attempts: m.attempts ?? 0,
    createdAt: m.createdAt ?? new Date().toISOString(),
  });
}

export async function getMutations(): Promise<QueuedMutation[]> {
  const d = await db();
  return (await d.getAll("mutations")) as QueuedMutation[];
}

export async function deleteMutation(id: number): Promise<void> {
  const d = await db();
  await d.delete("mutations", id);
}

export async function updateMutation(m: QueuedMutation): Promise<void> {
  const d = await db();
  await d.put("mutations", m);
}

export async function pendingCount(): Promise<number> {
  const d = await db();
  return d.count("mutations");
}

export async function setMeta(key: string, value: any): Promise<void> {
  const d = await db();
  await d.put("meta", value, key);
}
export async function getMeta<T = any>(key: string): Promise<T | undefined> {
  const d = await db();
  return (await d.get("meta", key)) as T | undefined;
}
