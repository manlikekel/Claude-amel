/**
 * Fault similarity scoring + Suggested Fixes ranking engine.
 *
 * Pure, side-effect-free utilities. All data fetching happens in data.ts;
 * this file only ranks and scores in-memory.
 */

import type { LogEntry } from "./data";

export interface CommunityEntry {
  id: string;
  source_log_id: string;
  aircraft_model: string | null;
  manufacturer: string | null;
  ata_chapter: string | null;
  fault_description: string;
  action_taken: string | null;
  root_cause: string | null;
  system_component: string | null;
  maintenance_reference: string | null;
  country_region: string | null;
  created_at: string;
}

export type ScopedResult<T> = T & {
  _similarity: number;
  _exact_aircraft: boolean;
  _exact_ata: boolean;
};

const SYNONYMS: Record<string, string[]> = {
  hot: ["high temp", "overheat", "high temperature", "warm"],
  "high temp": ["hot", "overheat"],
  low: ["insufficient", "weak", "below"],
  insufficient: ["low", "weak"],
  "not working": ["inoperative", "fail", "failure", "u/s", "unserviceable"],
  inop: ["inoperative", "not working", "failure"],
  inoperative: ["inop", "not working", "failure"],
  leak: ["pressure loss", "leakage", "weeping", "seeping"],
  failure: ["fault", "defect", "malfunction"],
  fault: ["failure", "defect"],
  fluctuation: ["unstable", "intermittent", "spike"],
  pack: ["air conditioning", "ac unit"],
  egt: ["exhaust gas temperature"],
};

function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function expandWithSynonyms(tokens: string[]): Set<string> {
  const set = new Set(tokens);
  for (const tok of tokens) {
    const list = SYNONYMS[tok];
    if (list) for (const s of list) for (const w of s.split(" ")) set.add(w);
  }
  return set;
}

function ataCode(ata: string | null | undefined): string | null {
  if (!ata) return null;
  const m = ata.match(/\b(\d{2,3})\b/);
  return m ? m[1].padStart(2, "0") : null;
}

interface ScoreInput {
  query: string;
  aircraftFilter?: string; // exact model
  ataFilter?: string; // ATA code only ("21")
}

interface Searchable {
  fault_description?: string | null;
  action_taken?: string | null;
  system_component?: string | null;
  ata_chapter?: string | null;
  aircraft_model?: string | null;
}

export function scoreEntry(item: Searchable, input: ScoreInput): {
  similarity: number;
  exactAircraft: boolean;
  exactAta: boolean;
} {
  const queryTokens = tokenize(input.query);
  const queryExpanded = expandWithSynonyms(queryTokens);

  const haystackText = [
    item.fault_description,
    item.action_taken,
    item.system_component,
  ].filter(Boolean).join(" ").toLowerCase();
  const haystackTokens = new Set(tokenize(haystackText));

  // 1. Direct keyword match (% of query tokens present)
  let directMatches = 0;
  for (const t of queryTokens) if (haystackTokens.has(t)) directMatches++;
  const keywordMatch = queryTokens.length ? directMatches / queryTokens.length : 0;

  // 2. Synonym match (any expanded token present beyond direct hits)
  let synonymMatches = 0;
  for (const t of queryExpanded) if (!queryTokens.includes(t) && haystackTokens.has(t)) synonymMatches++;
  const synonymMatch = queryExpanded.size ? Math.min(1, synonymMatches / Math.max(1, queryExpanded.size - queryTokens.length)) : 0;

  // 3. ATA match
  const itemAta = ataCode(item.ata_chapter);
  const exactAta = !!input.ataFilter && itemAta === input.ataFilter;
  const ataMatch = exactAta ? 1 : 0;

  // 4. Aircraft model match (case-insensitive)
  const exactAircraft =
    !!input.aircraftFilter &&
    !!item.aircraft_model &&
    item.aircraft_model.toLowerCase() === input.aircraftFilter.toLowerCase();
  const aircraftMatch = exactAircraft ? 1 : 0;

  const similarity =
    0.5 * keywordMatch +
    0.2 * synonymMatch +
    0.2 * ataMatch +
    0.1 * aircraftMatch;

  return { similarity, exactAircraft, exactAta };
}

export function rankResults<T extends Searchable>(
  items: T[],
  input: ScoreInput,
): ScopedResult<T>[] {
  return items
    .map((item) => {
      const s = scoreEntry(item, input);
      return {
        ...item,
        _similarity: s.similarity,
        _exact_aircraft: s.exactAircraft,
        _exact_ata: s.exactAta,
      } as ScopedResult<T>;
    })
    .filter((x) => x._similarity > 0.05)
    .sort((a, b) => {
      if (b._similarity !== a._similarity) return b._similarity - a._similarity;
      if (Number(b._exact_aircraft) !== Number(a._exact_aircraft)) return Number(b._exact_aircraft) - Number(a._exact_aircraft);
      if (Number(b._exact_ata) !== Number(a._exact_ata)) return Number(b._exact_ata) - Number(a._exact_ata);
      return 0;
    });
}

// ---------- Suggested Fixes ranking ----------

const ACTION_NORMALIZATION: Array<[RegExp, string]> = [
  [/\b(replac(?:ed|e)|chang(?:ed|e))\b/i, "replace"],
  [/\b(fix(?:ed)?|repair(?:ed)?|rectif(?:y|ied))\b/i, "rectify"],
  [/\b(check(?:ed)?|inspect(?:ed)?)\b/i, "inspect"],
  [/\b(test(?:ed)?|functional test)\b/i, "functional test"],
  [/\b(install(?:ed)?)\b/i, "install"],
  [/\b(remov(?:ed|e))\b/i, "remove"],
  [/\b(troubleshoot(?:ed|ing)?)\b/i, "troubleshoot"],
  [/\b(clean(?:ed)?)\b/i, "clean"],
  [/\b(adjust(?:ed)?)\b/i, "adjust"],
  [/\b(rig(?:ged)?)\b/i, "rig"],
  [/\b(lubricat(?:ed|e))\b/i, "lubricate"],
];

function normalizeActionVerb(action: string): string | null {
  if (!action) return null;
  for (const [re, verb] of ACTION_NORMALIZATION) if (re.test(action)) return verb;
  return null;
}

function extractTarget(action: string): string {
  // Take a noun phrase: drop the verb, keep up to 5 words.
  const cleaned = action
    .toLowerCase()
    .replace(/^(i\s+)?(replaced|changed|fixed|repaired|rectified|checked|inspected|tested|installed|removed|troubleshot|cleaned|adjusted|rigged|lubricated|carried\s+out|performed)\s+/i, "")
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[.,;].*/g, "")
    .trim();
  return cleaned.split(/\s+/).slice(0, 5).join(" ");
}

export interface SuggestedFix {
  action: string; // "Replace ram air fan"
  occurrences: number;
  avgSimilarity: number;
  modelMatch: number;
  ataMatch: number;
  confidence: number;
  level: "High" | "Medium" | "Low";
}

interface SuggestionInput {
  scopedLogs: ScopedResult<LogEntry>[];
  scopedCommunity: ScopedResult<CommunityEntry>[];
}

export function rankSuggestedFixes({ scopedLogs, scopedCommunity }: SuggestionInput): SuggestedFix[] {
  type Bucket = {
    verb: string;
    target: string;
    occurrences: number;
    simSum: number;
    modelHits: number;
    ataHits: number;
  };
  const buckets = new Map<string, Bucket>();

  const consume = <T extends Searchable & { action_taken?: string | null }>(
    entries: ScopedResult<T>[],
  ) => {
    for (const e of entries) {
      const action = (e.action_taken || "").trim();
      if (!action) continue;
      const verb = normalizeActionVerb(action);
      if (!verb) continue;
      const target = extractTarget(action);
      if (!target) continue;
      const key = `${verb}::${target}`;
      const existing = buckets.get(key) ?? {
        verb,
        target,
        occurrences: 0,
        simSum: 0,
        modelHits: 0,
        ataHits: 0,
      };
      existing.occurrences += 1;
      existing.simSum += e._similarity;
      if (e._exact_aircraft) existing.modelHits += 1;
      if (e._exact_ata) existing.ataHits += 1;
      buckets.set(key, existing);
    }
  };

  consume(scopedLogs);
  consume(scopedCommunity);

  const totalSeen = Math.max(1, ...Array.from(buckets.values()).map((b) => b.occurrences));

  const out: SuggestedFix[] = Array.from(buckets.values()).map((b) => {
    const avgSimilarity = b.occurrences ? b.simSum / b.occurrences : 0;
    const modelMatch = b.occurrences ? b.modelHits / b.occurrences : 0;
    const ataMatch = b.occurrences ? b.ataHits / b.occurrences : 0;
    const frequencyWeight = b.occurrences / totalSeen;
    const confidence =
      0.4 * modelMatch + 0.3 * ataMatch + 0.2 * avgSimilarity + 0.1 * frequencyWeight;
    const level: SuggestedFix["level"] =
      confidence >= 0.75 ? "High" : confidence >= 0.5 ? "Medium" : "Low";
    const verbCap = b.verb[0].toUpperCase() + b.verb.slice(1);
    return {
      action: `${verbCap} ${b.target}`,
      occurrences: b.occurrences,
      avgSimilarity,
      modelMatch,
      ataMatch,
      confidence,
      level,
    };
  });

  return out.sort((a, b) => b.confidence - a.confidence || b.occurrences - a.occurrences).slice(0, 8);
}
