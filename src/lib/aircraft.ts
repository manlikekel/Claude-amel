/**
 * Aircraft helpers — registration normalization & types shared between
 * client UI and server lookup function.
 */

export interface AircraftLookupResult {
  status: "found" | "not_found" | "error";
  source: string | null;
  model: string | null;
  manufacturer: string | null;
  aircraft_type_code: string | null;
  icao24: string | null;
  serial_number: string | null;
  operator_name: string | null;
  message?: string;
}

/** Normalize a registration / tail number for storage and lookup.
 *  Removes whitespace and dashes, uppercases. e.g. "5n-xel" -> "5NXEL". */
export function normalizeRegistration(reg: string): string {
  return (reg || "").replace(/[\s-]/g, "").toUpperCase();
}

/** Best-effort display formatting (kept simple — many CAAs use a hyphen
 *  after the country prefix). We do NOT mutate user input on save. */
export function looksLikeRegistration(reg: string): boolean {
  const r = normalizeRegistration(reg);
  return r.length >= 3 && r.length <= 8 && /^[A-Z0-9]+$/.test(r);
}
