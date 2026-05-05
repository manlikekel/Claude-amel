import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { normalizeRegistration, type AircraftLookupResult } from "./aircraft";

/**
 * Server function: lookup an aircraft by registration / tail number.
 *
 * Strategy:
 *   1. Check our shared lookup cache (only for fresh, non-expired rows).
 *   2. Hexdb.io  — works for most international regs (incl. 5N-, D-, G-, N-).
 *   3. OpenSky   — fallback to fetch ICAO24 + model from their metadata API.
 *   4. Persist any successful or "not_found" result to the cache so we
 *      don't hammer upstream.
 *
 * Always returns a structured result — errors are reported, never thrown,
 * so the UI never blocks the engineer's workflow.
 */
export const lookupAircraft = createServerFn({ method: "POST" })
  .inputValidator((input: { registration: string }) => {
    if (!input || typeof input.registration !== "string") {
      throw new Error("registration is required");
    }
    const norm = normalizeRegistration(input.registration);
    if (norm.length < 2 || norm.length > 10) {
      throw new Error("registration looks invalid");
    }
    return { registration: input.registration, normalized: norm };
  })
  .handler(async ({ data }): Promise<AircraftLookupResult & { normalized: string }> => {
    const norm = data.normalized;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    // Build an authenticated client (so we can use the SECURITY DEFINER upsert
    // which requires auth.uid()). Falls back gracefully if user is not signed in.
    const authHeader = getRequestHeader("authorization");
    let supabase: ReturnType<typeof createClient<Database>> | null = null;
    if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
      supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
        auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      });
    }

    // 1. Check cache
    if (supabase) {
      try {
        const { data: cached } = await supabase
          .from("aircraft_lookup_cache")
          .select("*")
          .eq("normalized_registration", norm)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (cached) {
          return {
            normalized: norm,
            status: cached.status as AircraftLookupResult["status"],
            source: cached.lookup_source ?? "cache",
            model: cached.model,
            manufacturer: cached.manufacturer,
            aircraft_type_code: cached.aircraft_type_code,
            icao24: cached.icao24,
            serial_number: cached.serial_number,
            operator_name: cached.operator_name,
          };
        }
      } catch (e) {
        console.error("Cache read failed:", e);
      }
    }

    // 2. Hexdb.io primary lookup
    const result = await tryHexdb(norm).catch((e) => {
      console.error("Hexdb error:", e);
      return null;
    });

    let final: AircraftLookupResult;
    if (result && result.status === "found") {
      final = result;
    } else {
      // 3. OpenSky fallback (resolve ICAO24 then metadata)
      const opensky = await tryOpenSky(norm).catch((e) => {
        console.error("OpenSky error:", e);
        return null;
      });
      if (opensky && opensky.status === "found") {
        final = opensky;
      } else {
        final = {
          status: "not_found",
          source: null,
          model: null,
          manufacturer: null,
          aircraft_type_code: null,
          icao24: null,
          serial_number: null,
          operator_name: null,
          message: "No database match found. Enter model manually.",
        };
      }
    }

    // 4. Cache the result (only when authenticated)
    if (supabase && authHeader) {
      try {
        await supabase.rpc("upsert_aircraft_lookup_cache", {
          p_norm: norm,
          p_model: final.model ?? "",
          p_manufacturer: final.manufacturer ?? "",
          p_type_code: final.aircraft_type_code ?? "",
          p_icao24: final.icao24 ?? "",
          p_serial: final.serial_number ?? "",
          p_operator: final.operator_name ?? "",
          p_source: final.source ?? "",
          p_status: final.status,
          p_raw: null as never,
        });
      } catch (e) {
        console.error("Cache write failed:", e);
      }
    }

    return { ...final, normalized: norm };
  });

async function tryHexdb(norm: string): Promise<AircraftLookupResult | null> {
  // Hexdb.io accepts the registration as displayed (with hyphen) — try both.
  const candidates = [norm, hyphenate(norm)];
  for (const reg of candidates) {
    const url = `https://hexdb.io/api/v1/aircraft/reg/${encodeURIComponent(reg)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) continue;
    const json: any = await res.json().catch(() => null);
    if (!json || !json.Registration) continue;
    return {
      status: "found",
      source: "hexdb",
      model: json.Type || null,
      manufacturer: json.Manufacturer || null,
      aircraft_type_code: json.ICAOTypeCode || null,
      icao24: json.ModeS ? String(json.ModeS).toLowerCase() : null,
      serial_number: json.SerialNumber || null,
      operator_name: json.RegisteredOwners || json.OperatorFlagCode || null,
    };
  }
  return null;
}

async function tryOpenSky(norm: string): Promise<AircraftLookupResult | null> {
  // OpenSky exposes /api/metadata/aircraft/registration/{reg} as a public endpoint.
  const candidates = [hyphenate(norm), norm];
  for (const reg of candidates) {
    const url = `https://opensky-network.org/api/metadata/aircraft/registration/${encodeURIComponent(reg)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) continue;
    const json: any = await res.json().catch(() => null);
    if (!json || (!json.model && !json.icao24)) continue;
    return {
      status: "found",
      source: "opensky",
      model: json.model || json.typecode || null,
      manufacturer: json.manufacturerName || json.manufacturerIcao || null,
      aircraft_type_code: json.typecode || null,
      icao24: json.icao24 ? String(json.icao24).toLowerCase() : null,
      serial_number: json.serialNumber || null,
      operator_name: json.operator || json.owner || null,
    };
  }
  return null;
}

/** Re-insert a hyphen after the typical 1–2 char country prefix.
 *  e.g. "5NXEL" -> "5N-XEL", "N123AB" -> "N-123AB", "DABCD" -> "D-ABCD". */
function hyphenate(norm: string): string {
  if (norm.includes("-")) return norm;
  // N-numbers: single N + digits
  if (/^N\d/.test(norm)) return norm; // FAA N-numbers are typically queried without hyphen
  // 2-char prefix (most common: 5N, VH, JA, OE, OY, SE, EI, OK, TC, …)
  if (/^[A-Z0-9]{2}[A-Z0-9]+$/.test(norm) && norm.length >= 4) {
    return `${norm.slice(0, 2)}-${norm.slice(2)}`;
  }
  // 1-char prefix (D, F, G, I, …)
  if (/^[A-Z][A-Z0-9]+$/.test(norm)) {
    return `${norm.slice(0, 1)}-${norm.slice(1)}`;
  }
  return norm;
}
