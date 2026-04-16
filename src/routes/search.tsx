import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Search as SearchIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { searchLogs, type LogEntry } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Fault Search – AMEL" },
      { name: "description", content: "Search and find fault solutions." },
    ],
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
  const causes: string[] = [];
  const actions: string[] = [];
  Object.entries(COMMON_CAUSES).forEach(([key, vals]) => {
    if (q.includes(key)) causes.push(...vals);
  });
  Object.entries(COMMON_ACTIONS).forEach(([key, vals]) => {
    if (q.includes(key)) actions.push(...vals);
  });
  return { causes, actions };
}

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LogEntry[]>([]);
  const [suggestions, setSuggestions] = useState<{ causes: string[]; actions: string[] }>({
    causes: [],
    actions: [],
  });
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = (q: string) => {
    setQuery(q);
    if (q.trim().length > 1) {
      setResults(searchLogs(q));
      setSuggestions(getSuggestions(q));
      setHasSearched(true);
    } else {
      setResults([]);
      setSuggestions({ causes: [], actions: [] });
      setHasSearched(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 relative overflow-hidden">
      <div className="pointer-events-none absolute top-20 left-0 h-40 w-40 rounded-full bg-primary/5 blur-[80px]" />

      <div className="mx-auto max-w-lg px-5 pt-6 relative">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-foreground">Fault Search</h1>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => doSearch(e.target.value)}
            placeholder="Describe the issue… (e.g. CRJ200 pack low pressure)"
            className="h-12 pl-10 text-base"
          />
        </div>

        <AnimatePresence mode="wait">
          {hasSearched && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  Your Past Fixes
                </h2>
                {results.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matching logs found.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {results.slice(0, 10).map((log) => (
                      <Card key={log.id} className="p-3">
                        <p className="text-xs font-semibold text-primary">{log.aircraft_type}</p>
                        <p className="text-sm text-foreground">{log.fault_description}</p>
                        {log.action_taken && (
                          <p className="mt-1 text-xs text-muted-foreground">✓ {log.action_taken}</p>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              {suggestions.causes.length > 0 && (
                <section>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                    Suggested Causes
                  </h2>
                  <div className="flex flex-col gap-1.5">
                    {suggestions.causes.map((c) => (
                      <Card key={c} className="px-3 py-2">
                        <p className="text-sm text-foreground">⚡ {c}</p>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {suggestions.actions.length > 0 && (
                <section>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                    Suggested Actions
                  </h2>
                  <div className="flex flex-col gap-1.5">
                    {suggestions.actions.map((a) => (
                      <Card key={a} className="px-3 py-2">
                        <p className="text-sm text-foreground">🔧 {a}</p>
                      </Card>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!hasSearched && (
          <div className="mt-12 flex flex-col items-center text-center">
            <SearchIcon className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Type a fault description to search your logs and get suggestions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
