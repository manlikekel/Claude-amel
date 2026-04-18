import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { searchLogs, type LogEntry } from "@/lib/data";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [{ title: "Fault Search – AMEL" }, { name: "description", content: "Search and find fault solutions." }],
  }),
  component: SearchPage,
});

const COMMON_CAUSES: Record<string, string[]> = {
  "low pressure": ["Bleed valve stuck", "Pack valve malfunction", "Duct leak", "Regulator failure"],
  "high egt": ["Fuel nozzle blockage", "Compressor stall", "Bleed air leak", "Dirty turbine"],
  "no start": ["Igniter failure", "Fuel shutoff valve", "Starter generator fault", "Low battery"],
  vibration: ["Fan blade damage", "Bearing wear", "Unbalanced rotor", "Loose cowling"],
  leak: ["O-ring degradation", "Seal failure", "Cracked fitting", "Corrosion damage"],
};
const COMMON_ACTIONS: Record<string, string[]> = {
  "low pressure": ["Check bleed valve operation", "Inspect duct integrity", "Test pack valve", "Verify regulator output"],
  "high egt": ["Inspect fuel nozzles", "Perform compressor wash", "Check for bleed leaks", "Boroscope inspection"],
  "no start": ["Test igniter output", "Verify fuel pressure", "Check starter engagement", "Load test battery"],
  vibration: ["Boroscope fan blades", "Check bearing temps", "Verify torque on cowling", "Balance check"],
  leak: ["Replace O-rings", "Inspect seals per AMM", "Torque fittings to spec", "NDT inspection"],
};

function getSuggestions(query: string) {
  const q = query.toLowerCase();
  const causes: string[] = [], actions: string[] = [];
  Object.entries(COMMON_CAUSES).forEach(([k, v]) => { if (q.includes(k)) causes.push(...v); });
  Object.entries(COMMON_ACTIONS).forEach(([k, v]) => { if (q.includes(k)) actions.push(...v); });
  return { causes, actions };
}

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LogEntry[]>([]);
  const [suggestions, setSuggestions] = useState<{ causes: string[]; actions: string[] }>({ causes: [], actions: [] });
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  const doSearch = async (q: string) => {
    setQuery(q);
    if (q.trim().length > 1) {
      setSearching(true);
      setHasSearched(true);
      setSuggestions(getSuggestions(q));
      try {
        setResults(await searchLogs(q));
      } finally { setSearching(false); }
    } else {
      setResults([]); setSuggestions({ causes: [], actions: [] }); setHasSearched(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32 relative overflow-hidden">
      <div className="pointer-events-none absolute top-20 left-0 h-40 w-40 rounded-full bg-primary/5 blur-[80px]" />

      <div className="mx-auto max-w-lg px-5 pt-10 relative">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary drop-shadow-[0_0_12px_oklch(0.78_0.12_80/0.3)]">Fault Search</h1>
          <p className="text-sm text-muted-foreground mt-1">Past fixes & quick suggestions</p>
        </div>

        <div className="relative mb-6">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => doSearch(e.target.value)}
            placeholder="Describe the issue… (e.g. CRJ200 pack low pressure)"
            className="h-12 pl-10 text-base"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}
        </div>

        <AnimatePresence mode="wait">
          {hasSearched && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Your Past Fixes</h2>
                {results.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matching logs found.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {results.slice(0, 10).map((log) => (
                      <Link key={log.id} to="/log" search={{ id: log.id }}>
                        <Card className="p-3 hover:border-primary/40 transition-colors">
                          <p className="text-xs font-semibold text-primary">{log.aircraft_model || log.registration || "Aircraft"}</p>
                          <p className="text-sm text-foreground line-clamp-2">{log.fault_description}</p>
                          {log.action_taken && <p className="mt-1 text-xs text-muted-foreground line-clamp-1">✓ {log.action_taken}</p>}
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              {suggestions.causes.length > 0 && (
                <section>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Suggested Causes</h2>
                  <div className="flex flex-col gap-1.5">
                    {suggestions.causes.map((c) => <Card key={c} className="px-3 py-2"><p className="text-sm text-foreground">⚡ {c}</p></Card>)}
                  </div>
                </section>
              )}

              {suggestions.actions.length > 0 && (
                <section>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Suggested Actions</h2>
                  <div className="flex flex-col gap-1.5">
                    {suggestions.actions.map((a) => <Card key={a} className="px-3 py-2"><p className="text-sm text-foreground">🔧 {a}</p></Card>)}
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!hasSearched && (
          <div className="mt-12 flex flex-col items-center text-center">
            <SearchIcon className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Type a fault to search your logs and get suggestions.</p>
          </div>
        )}
      </div>
    </div>
  );
}
