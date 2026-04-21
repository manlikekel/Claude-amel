/**
 * Licence-readiness frameworks.
 *
 * Each framework defines an experience profile that an AME should accumulate
 * before sitting practical/oral examinations. Numbers are best-effort
 * approximations based on publicly available regulatory guidance:
 *  - NCAA Nig.CARs Part 2.7 / O-PEL-020 logbook requirements.
 *  - EASA Part-66 Appendix III (B1/B2 experience).
 *  - FAA 14 CFR §65.77 (A&P general experience).
 *
 * They are intentionally simplified into 4 measurable buckets so we can
 * compute a single "readiness %". Adjust as users / regulators clarify.
 */

export type FrameworkId = "NCAA" | "EASA" | "FAA";

export interface FrameworkProfile {
  id: FrameworkId;
  name: string;
  fullName: string;
  /** Total practical hours expected before licence application. */
  requiredHours: number;
  /** Distinct aircraft types expected in the logbook. */
  requiredAircraftTypes: number;
  /** Distinct ATA chapters that should appear at least once. */
  requiredAtaCoverage: number;
  /** Total number of recorded jobs / tasks. */
  requiredJobs: number;
  /**
   * ATA chapter codes (2-digit) that the regulator considers "core".
   * Used to flag weak areas the candidate hasn't touched.
   */
  coreAtaChapters: string[];
  notes: string;
}

export const FRAMEWORKS: Record<FrameworkId, FrameworkProfile> = {
  NCAA: {
    id: "NCAA",
    name: "NCAA",
    fullName: "Nigeria Civil Aviation Authority — Part 2.7 AME",
    requiredHours: 2400,
    requiredAircraftTypes: 2,
    requiredAtaCoverage: 18,
    requiredJobs: 120,
    coreAtaChapters: [
      "21", "22", "23", "24", "27", "28", "29", "31", "32",
      "34", "36", "49", "52", "53", "57", "71", "72", "73", "78",
    ],
    notes: "Based on Nig.CARs Part 2.7 practical experience and O-PEL-020 logbook expectations.",
  },
  EASA: {
    id: "EASA",
    name: "EASA Part-66",
    fullName: "EASA Part-66 B1/B2 Licence",
    requiredHours: 2400,
    requiredAircraftTypes: 2,
    requiredAtaCoverage: 20,
    requiredJobs: 150,
    coreAtaChapters: [
      "21", "22", "23", "24", "25", "26", "27", "28", "29", "31",
      "32", "33", "34", "35", "36", "49", "52", "53", "57", "71",
      "72", "73", "75", "77", "78", "79",
    ],
    notes: "Approximation of Part-66 Appendix III B1.1 large-aircraft experience profile.",
  },
  FAA: {
    id: "FAA",
    name: "FAA A&P",
    fullName: "FAA 14 CFR §65 Airframe & Powerplant",
    requiredHours: 1900,
    requiredAircraftTypes: 1,
    requiredAtaCoverage: 16,
    requiredJobs: 100,
    coreAtaChapters: [
      "21", "23", "24", "27", "28", "29", "32", "33", "34",
      "36", "49", "52", "53", "57", "71", "72", "73", "77",
    ],
    notes: "Derived from §65.77 (30 months experience) and PTS Airframe & Powerplant subject areas.",
  },
};

export interface ReadinessInput {
  totalHours: number;
  totalJobs: number;
  aircraftTypes: Set<string>;
  ataChapters: Set<string>; // 2-digit codes only
}

export interface ReadinessResult {
  framework: FrameworkProfile;
  /** 0–100 overall readiness percentage. */
  overall: number;
  buckets: {
    hours: { value: number; required: number; pct: number };
    jobs: { value: number; required: number; pct: number };
    aircraftTypes: { value: number; required: number; pct: number };
    ataCoverage: { value: number; required: number; pct: number };
  };
  /** Core ATA chapters not yet covered. */
  missingAtaChapters: string[];
  /** Top 3 areas with the lowest progress, with friendly labels. */
  weakAreas: Array<{ label: string; pct: number; advice: string }>;
  /** Single recommended next step. */
  nextFocus: string;
}

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function computeReadiness(
  input: ReadinessInput,
  frameworkId: FrameworkId,
): ReadinessResult {
  const f = FRAMEWORKS[frameworkId];

  const buckets = {
    hours: {
      value: Math.round(input.totalHours),
      required: f.requiredHours,
      pct: clampPct((input.totalHours / f.requiredHours) * 100),
    },
    jobs: {
      value: input.totalJobs,
      required: f.requiredJobs,
      pct: clampPct((input.totalJobs / f.requiredJobs) * 100),
    },
    aircraftTypes: {
      value: input.aircraftTypes.size,
      required: f.requiredAircraftTypes,
      pct: clampPct((input.aircraftTypes.size / f.requiredAircraftTypes) * 100),
    },
    ataCoverage: {
      value: input.ataChapters.size,
      required: f.requiredAtaCoverage,
      pct: clampPct((input.ataChapters.size / f.requiredAtaCoverage) * 100),
    },
  };

  // Core ATA chapters not touched
  const missingAtaChapters = f.coreAtaChapters.filter(
    (c) => !input.ataChapters.has(c),
  );

  // Weighted overall (hours and ATA breadth matter most)
  const overall = clampPct(
    buckets.hours.pct * 0.35 +
      buckets.ataCoverage.pct * 0.3 +
      buckets.jobs.pct * 0.2 +
      buckets.aircraftTypes.pct * 0.15,
  );

  const labelled = [
    { key: "hours", label: "Practical Hours", pct: buckets.hours.pct, advice: "Log more hours on real maintenance tasks." },
    { key: "ataCoverage", label: "ATA Breadth", pct: buckets.ataCoverage.pct, advice: "Work on more diverse ATA chapters." },
    { key: "jobs", label: "Recorded Jobs", pct: buckets.jobs.pct, advice: "Capture more jobs in your logbook." },
    { key: "aircraftTypes", label: "Aircraft Variety", pct: buckets.aircraftTypes.pct, advice: "Get exposure on additional aircraft types." },
  ];

  const weakAreas = labelled
    .filter((b) => b.pct < 100)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);

  let nextFocus: string;
  if (missingAtaChapters.length > 0) {
    nextFocus = `Get exposure on core ATA chapter ${missingAtaChapters[0]} — it's missing from your logbook.`;
  } else if (weakAreas.length > 0) {
    nextFocus = weakAreas[0].advice;
  } else {
    nextFocus = "You meet the baseline profile. Keep logging to maintain currency.";
  }

  return { framework: f, overall, buckets, missingAtaChapters, weakAreas, nextFocus };
}
