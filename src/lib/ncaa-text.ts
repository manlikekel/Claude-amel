/**
 * Generates the "Details of Work Undertaken" sentence for the NCAA O-PEL-020
 * Practical Maintenance Experience export.
 *
 * Sentence pattern: [ATA if available] – I participated in the [normalized action]
 * on the [system/component] I.A.W [reference].
 */

const ACTION_NORMALIZATION: Array<[RegExp, string]> = [
  [/\bcarried out test\b/i, "functional testing of"],
  [/\bcarried out\b/i, ""],
  [/\bperformed\b/i, ""],
  [/\bleak check(?:ed)?\b/i, "leak check of"],
  [/\bchanged\b/i, "replacement of"],
  [/\breplaced\b/i, "replacement of"],
  [/\bfixed\b/i, "rectification of"],
  [/\brepaired\b/i, "rectification of"],
  [/\brectified\b/i, "rectification of"],
  [/\bchecked\b/i, "inspection of"],
  [/\binspected\b/i, "inspection of"],
  [/\btested\b/i, "functional testing of"],
  [/\bfunctional test(?:ed)?\b/i, "functional testing of"],
  [/\binstalled\b/i, "installation of"],
  [/\bremoved\b/i, "removal of"],
  [/\btroubleshot\b/i, "troubleshooting of"],
  [/\btroubleshooted\b/i, "troubleshooting of"],
  [/\brigged\b/i, "rigging of"],
  [/\badjusted\b/i, "adjustment of"],
  [/\bcleaned\b/i, "cleaning of"],
  [/\bgreased\b/i, "lubrication of"],
  [/\blubricated\b/i, "lubrication of"],
];

const ATA_SYSTEM_FALLBACK: Record<string, string> = {
  "05": "time limits / maintenance checks",
  "21": "air conditioning system",
  "22": "auto flight system",
  "23": "communications system",
  "24": "electrical power system",
  "25": "equipment / furnishings",
  "26": "fire protection system",
  "27": "flight controls system",
  "28": "fuel system",
  "29": "hydraulic power system",
  "30": "ice and rain protection system",
  "31": "instruments system",
  "32": "landing gear system",
  "33": "lights system",
  "34": "navigation system",
  "35": "oxygen system",
  "36": "pneumatic system",
  "38": "water and waste system",
  "49": "APU system",
  "52": "doors",
  "53": "fuselage",
  "54": "nacelles / pylons",
  "55": "stabilizers",
  "56": "windows",
  "57": "wings",
  "71": "powerplant",
  "72": "engine",
  "73": "engine fuel system",
  "74": "ignition system",
  "75": "engine bleed air system",
  "76": "engine controls system",
  "77": "engine indicating system",
  "78": "engine exhaust system",
  "79": "engine oil system",
  "80": "starting system",
};

const REFERENCE_REGEX = /\b(AMM|FIM|SRM|CMM|IPC|TSM|MEL|SB|AD)\s*[-:]?\s*\d{1,3}[-\s]?\d{1,3}[-\s]?\d{0,3}\b/i;

function extractAtaCode(ata: string | undefined | null): string | null {
  if (!ata) return null;
  const m = ata.match(/\b(\d{2,3})\b/);
  return m ? m[1].padStart(2, "0") : null;
}

function normalizeAction(actionRaw: string): string {
  let s = (actionRaw || "").trim().toLowerCase();
  if (!s) return "";
  for (const [re, replacement] of ACTION_NORMALIZATION) {
    if (re.test(s)) {
      // Replace first matching verb with the normalized phrase, then take the rest as object
      s = s.replace(re, replacement).trim();
      break;
    }
  }
  // Strip leading filler/connector words after normalization
  s = s.replace(/^(of|the|a|an|and|to)\s+/i, "");
  // Collapse whitespace
  return s.replace(/\s+/g, " ").trim();
}

function inferComponentFromText(text: string): string {
  const t = text.toLowerCase();
  // Try to grab a noun phrase after common articles
  const m = t.match(/\b(?:on the|of the|the)\s+([a-z][a-z\s\-]{2,40})/);
  if (m) return m[1].replace(/\s+/g, " ").trim();
  // Strip leading verbs / our normalized openers
  return t.replace(/^(replacement of|inspection of|rectification of|installation of|removal of|troubleshooting of|functional testing of|leak check of|rigging of|adjustment of|cleaning of|lubrication of)\s+/, "").trim();
}

function extractReference(...sources: string[]): string | null {
  for (const s of sources) {
    if (!s) continue;
    const m = s.match(REFERENCE_REGEX);
    if (m) return m[0].toUpperCase().replace(/\s+/g, " ");
  }
  return null;
}

export interface NcaaSourceFields {
  ata_chapter?: string | null;
  fault_description?: string | null;
  action_taken?: string | null;
  system_component?: string | null;
  maintenance_reference?: string | null;
  tools_used?: string | null;
}

export function generateNcaaWorkDetails(
  log: NcaaSourceFields,
  opts: { includeAta?: boolean } = {},
): string {
  const includeAta = opts.includeAta ?? true;
  const ataCode = extractAtaCode(log.ata_chapter);

  // 1. Action — normalize from action_taken; fall back to fault_description
  const actionSource = (log.action_taken || "").trim() || (log.fault_description || "").trim();
  let normalized = normalizeAction(actionSource);

  // If normalization didn't happen (no recognised verb), default to "rectification of <fault>"
  let component = "";
  if (!normalized) {
    normalized = "rectification of";
  }

  // 2. System / component
  if (log.system_component && log.system_component.trim()) {
    component = log.system_component.trim().toLowerCase();
  } else {
    component = inferComponentFromText(`${normalized} ${log.fault_description ?? ""}`);
    if ((!component || component.length < 3) && ataCode && ATA_SYSTEM_FALLBACK[ataCode]) {
      component = ATA_SYSTEM_FALLBACK[ataCode];
    }
    if (!component || component.length < 3) component = "aircraft system";
  }

  // Strip the component out of the action phrase if it was dragged along
  const compRegex = new RegExp(`\\s+${component.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b.*`, "i");
  let actionClean = normalized.replace(compRegex, "").trim();
  if (!/of$/i.test(actionClean) && /\bof\b/i.test(actionClean)) {
    actionClean = actionClean.replace(/\bof\b.*$/i, "of").trim();
  }
  if (!actionClean) actionClean = "rectification of";

  // 3. Reference
  const reference =
    (log.maintenance_reference && log.maintenance_reference.trim()) ||
    extractReference(log.tools_used ?? "", log.action_taken ?? "", log.fault_description ?? "");

  // 4. Build sentence
  const ataPrefix = includeAta && ataCode ? `ATA ${ataCode} – ` : "";
  let sentence = `${ataPrefix}I participated in the ${actionClean} on the ${component}`;
  if (reference) sentence += ` I.A.W ${reference}`;
  if (!sentence.endsWith(".")) sentence += ".";

  // Capitalize the first letter after any ATA prefix
  return sentence.replace(/(I participated)/, (m) => m); // already correct case
}

/** Simple DD/MM/YYYY formatter for the date column. */
export function formatNcaaDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
