/**
 * Digital signatures for log entries.
 *
 * Uses the Web Crypto API with ECDSA P-256 to produce a real cryptographic
 * signature over a canonical hash of the log payload. Each user generates a
 * keypair on first use; the private key stays in IndexedDB on the device,
 * the public key (JWK) is embedded in every signature row so any third
 * party can verify the entry independently.
 *
 * This is a meaningful first step toward eIDAS / 14 CFR Part 11 compliance.
 * Real regulator acceptance still requires a qualified certificate from a
 * trusted CA — that wraps the same primitive used here.
 */
import { supabase } from "@/integrations/supabase/client";
import { openDB } from "idb";

const DB_NAME = "amel-keys";
const STORE = "keypair";

async function keyDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) { if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); },
  });
}

async function generateAndStore(): Promise<CryptoKeyPair> {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const db = await keyDb();
  await db.put(STORE, kp.privateKey, "private");
  await db.put(STORE, kp.publicKey, "public");
  return kp;
}

export async function getOrCreateKeyPair(): Promise<CryptoKeyPair> {
  const db = await keyDb();
  const priv = await db.get(STORE, "private") as CryptoKey | undefined;
  const pub = await db.get(STORE, "public") as CryptoKey | undefined;
  if (priv && pub) return { privateKey: priv, publicKey: pub };
  return generateAndStore();
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Canonical JSON serialisation: keys sorted, no whitespace.
 * Two callers that build the same payload will always hash identically.
 */
function canonicalize(obj: any): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalize).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
}

export async function hashLogPayload(payload: any): Promise<string> {
  const canonical = canonicalize(payload);
  const data = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export async function signLog(payload: any): Promise<{ logHash: string; signature: string; publicKeyJwk: JsonWebKey }> {
  const kp = await getOrCreateKeyPair();
  const logHash = await hashLogPayload(payload);
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    kp.privateKey,
    new TextEncoder().encode(logHash),
  );
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  return { logHash, signature: toBase64(sigBuf), publicKeyJwk };
}

export async function verifySignature(payload: any, signature: string, publicKeyJwk: JsonWebKey): Promise<boolean> {
  const logHash = await hashLogPayload(payload);
  const pub = await crypto.subtle.importKey(
    "jwk", publicKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true, ["verify"],
  );
  const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
  return crypto.subtle.verify(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    pub,
    sigBytes,
    new TextEncoder().encode(logHash),
  );
}

// ============ DB ============

export type SignatureRole = "engineer" | "examiner" | "qa_inspector";

export interface LogSignature {
  id: string;
  log_id: string;
  signer_user_id: string;
  role: SignatureRole;
  signed_at: string;
  log_hash: string;
  signature: string;
  public_key_jwk: any;
  signer_name: string;
  signer_licence_no: string;
  remarks: string;
}

export async function fetchSignatures(logId: string): Promise<LogSignature[]> {
  const { data, error } = await supabase
    .from("log_signatures")
    .select("*")
    .eq("log_id", logId)
    .order("signed_at", { ascending: true });
  if (error) { console.error(error); return []; }
  return (data ?? []) as unknown as LogSignature[];
}

export async function saveSignature(
  logId: string,
  role: SignatureRole,
  payload: any,
  meta: { signer_name?: string; signer_licence_no?: string; remarks?: string },
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { logHash, signature, publicKeyJwk } = await signLog(payload);
  const { error } = await supabase.from("log_signatures").insert({
    log_id: logId,
    signer_user_id: user.id,
    role,
    log_hash: logHash,
    signature,
    public_key_jwk: publicKeyJwk,
    signer_name: meta.signer_name ?? "",
    signer_licence_no: meta.signer_licence_no ?? "",
    remarks: meta.remarks ?? "",
  });
  if (error) {
    if (error.message?.includes("log_signatures") || error.code === "42P01") {
      throw new Error("Digital signatures aren't set up yet — please run the database migration in your Supabase SQL editor first.");
    }
    throw error;
  }
  // Lock the log so it can't be edited after signing
  await supabase.from("maintenance_logs").update({ locked_at: new Date().toISOString() }).eq("id", logId);
}

// ============ Co-sign requests ============

export interface CosignRequest {
  id: string;
  log_id: string;
  requester_id: string;
  examiner_email: string;
  examiner_user_id: string | null;
  status: "pending" | "signed" | "rejected" | "expired";
  message: string;
  responded_at: string | null;
  expires_at: string;
  created_at: string;
}

export async function requestCosign(logId: string, examinerEmail: string, message?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase.from("cosign_requests").insert({
    log_id: logId,
    requester_id: user.id,
    examiner_email: examinerEmail,
    message: message ?? "",
  });
  if (error) throw error;
  await supabase.from("maintenance_logs").update({ requires_cosign: true }).eq("id", logId);
}

export async function fetchCosignRequests(): Promise<CosignRequest[]> {
  const { data, error } = await supabase
    .from("cosign_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return (data ?? []) as unknown as CosignRequest[];
}
