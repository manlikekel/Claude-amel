export interface LogEntry {
  id: string;
  aircraft_type: string;
  registration: string;
  ata_chapter: string;
  fault_description: string;
  symptoms: string[];
  root_cause: string;
  action_taken: string;
  tools_used: string;
  time_spent: number;
  images: string[];
  is_recurring: boolean;
  created_at: string;
}

const STORAGE_KEY = "amel_logs";

export function getLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLog(entry: Omit<LogEntry, "id" | "created_at">): LogEntry {
  const logs = getLogs();
  const newEntry: LogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  logs.unshift(newEntry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  return newEntry;
}

export function getRecentLogs(count = 5): LogEntry[] {
  return getLogs().slice(0, count);
}

export function getStats() {
  const logs = getLogs();
  const aircraftTypes = new Set(logs.map((l) => l.aircraft_type));
  const totalHours = logs.reduce((sum, l) => sum + (l.time_spent || 0), 0);
  const ataChapters = new Set(logs.map((l) => l.ata_chapter.split(" ")[0]));
  return {
    totalLogs: logs.length,
    aircraftTypes: aircraftTypes.size,
    totalHours: Math.round(totalHours * 10) / 10,
    ataChapters: ataChapters.size,
  };
}

export function searchLogs(query: string): LogEntry[] {
  const q = query.toLowerCase();
  return getLogs().filter(
    (l) =>
      l.fault_description.toLowerCase().includes(q) ||
      l.aircraft_type.toLowerCase().includes(q) ||
      l.ata_chapter.toLowerCase().includes(q) ||
      l.action_taken.toLowerCase().includes(q) ||
      l.symptoms.some((s) => s.toLowerCase().includes(q))
  );
}

export function getExperienceData() {
  const logs = getLogs();
  const byAircraft: Record<string, { hours: number; jobs: number }> = {};
  const byAta: Record<string, number> = {};

  logs.forEach((l) => {
    if (!byAircraft[l.aircraft_type]) {
      byAircraft[l.aircraft_type] = { hours: 0, jobs: 0 };
    }
    byAircraft[l.aircraft_type].hours += l.time_spent || 0;
    byAircraft[l.aircraft_type].jobs += 1;

    const ata = l.ata_chapter.split(" ")[0];
    byAta[ata] = (byAta[ata] || 0) + 1;
  });

  return { byAircraft, byAta, totalJobs: logs.length };
}

export const AIRCRAFT_TYPES = [
  "CRJ200",
  "Challenger 601",
  "Challenger 604",
  "Challenger 605",
  "Embraer 170",
  "Embraer 190",
];

export const ATA_CHAPTERS = [
  "05 – Time Limits",
  "06 – Dimensions & Areas",
  "07 – Lifting & Shoring",
  "08 – Leveling & Weighing",
  "09 – Towing & Taxiing",
  "10 – Parking & Mooring",
  "11 – Placards & Markings",
  "12 – Servicing",
  "20 – Standard Practices",
  "21 – Air Conditioning",
  "22 – Auto Flight",
  "23 – Communications",
  "24 – Electrical Power",
  "25 – Equipment/Furnishings",
  "26 – Fire Protection",
  "27 – Flight Controls",
  "28 – Fuel",
  "29 – Hydraulic Power",
  "30 – Ice/Rain Protection",
  "31 – Instruments",
  "32 – Landing Gear",
  "33 – Lights",
  "34 – Navigation",
  "35 – Oxygen",
  "36 – Pneumatic",
  "38 – Water/Waste",
  "49 – APU",
  "52 – Doors",
  "53 – Fuselage",
  "54 – Nacelles/Pylons",
  "55 – Stabilizers",
  "56 – Windows",
  "57 – Wings",
  "71 – Powerplant",
  "72 – Engine",
  "73 – Engine Fuel",
  "74 – Ignition",
  "75 – Engine Bleed Air",
  "76 – Engine Controls",
  "77 – Engine Indicating",
  "78 – Engine Exhaust",
  "79 – Engine Oil",
  "80 – Starting",
];
