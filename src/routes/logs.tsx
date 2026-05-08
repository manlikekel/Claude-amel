import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, Filter, Loader2, Search as SearchIcon, Wrench, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchLogs, formatHoursMinutes, type LogEntry } from "@/lib/data";
import { motion } from "framer-motion";

type SortKey = "newest" | "oldest" | "time" | "aircraft";

export const Route = createFileRoute("/logs")({
  head: () => ({
    meta: [
      { title: "All Logs – AMEL" },
      { name: "description", content: "Browse, filter and search every maintenance log you've recorded." },
    ],
  }),
  component: LogsPage,
});

const PAGE_SIZE = 25;

function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("all");
  const [reg, setReg] = useState("all");
  const [ata, setAta] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    fetchLogs().then(setLogs).catch(() => setLogs([]));
  }, []);

  const all = logs ?? [];

  const models = useMemo(() => uniq(all.map((l) => l.aircraft_model)), [all]);
  const regs = useMemo(() => uniq(all.map((l) => l.registration)), [all]);
  const atas = useMemo(() => {
    const set = new Set<string>();
    for (const l of all) {
      const code = (l.ata_chapter || "").match(/\d{1,2}/)?.[0];
      if (code) set.add(`ATA ${code.padStart(2, "0")}`);
    }
    return [...set].sort();
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 24 * 3600 * 1000 : null;
    let out = all.filter((l) => {
      if (model !== "all" && (l.aircraft_model || "").trim().toUpperCase() !== model.toUpperCase()) return false;
      if (reg !== "all" && (l.registration || "").trim().toUpperCase() !== reg.toUpperCase()) return false;
      if (ata !== "all") {
        const code = (l.ata_chapter || "").match(/\d{1,2}/)?.[0];
        if (!code || `ATA ${code.padStart(2, "0")}` !== ata) return false;
      }
      const ts = new Date(l.created_at).getTime();
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
      if (q) {
        const hay = [l.fault_description, l.aircraft_model, l.registration, l.ata_chapter, l.action_taken, l.root_cause]
          .join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      switch (sort) {
        case "oldest": return +new Date(a.created_at) - +new Date(b.created_at);
        case "time": return (b.time_spent_hours || 0) - (a.time_spent_hours || 0);
        case "aircraft": return (a.aircraft_model || "").localeCompare(b.aircraft_model || "");
        default: return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
    return out;
  }, [all, query, model, reg, ata, from, to, sort]);

  const totalHours = filtered.reduce((s, l) => s + (l.time_spent_hours || 0), 0);

  // Reset page when filters change
  useEffect(() => { setVisible(PAGE_SIZE); }, [query, model, reg, ata, from, to, sort]);

  // Infinite scroll
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisible((v) => Math.min(v + PAGE_SIZE, filtered.length));
      }
    }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [filtered.length]);

  const shown = filtered.slice(0, visible);
  const activeFilterCount = [
    model !== "all", reg !== "all", ata !== "all", !!from, !!to,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="amel-page pt-10 relative">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <p className="label-overline">Logbook</p>
          <h1 className="page-title mt-1">All <span className="gold-text">Maintenance</span> Logs</h1>
          <p className="page-subtitle">
            {logs === null ? "Loading…" : `${filtered.length} log${filtered.length === 1 ? "" : "s"} · ${formatHoursMinutes(totalHours)}`}
          </p>
        </motion.div>

        {/* Search */}
        <div className="relative mb-3">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search logs... (fault, aircraft, ATA)"
            className="pl-9 placeholder:normal-case"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter + sort triggers */}
        <div className="mb-4 flex gap-2">
          <Button variant="action" size="sm" className="gap-1.5" onClick={() => setShowFilters((v) => !v)}>
            <Filter className="h-3.5 w-3.5" /> Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px] text-primary">{activeFilterCount}</span>
            )}
          </Button>
          <div className="relative flex-1">
            <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-8 w-full appearance-none rounded-lg glass pl-8 pr-3 text-xs font-medium text-foreground"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="time">Most time spent</option>
              <option value="aircraft">By aircraft</option>
            </select>
          </div>
        </div>

        {showFilters && (
          <Card className="mb-4 p-4">
            <div className="grid gap-3">
              <SelectField label="Aircraft Model" value={model} onChange={setModel} options={["all", ...models]} />
              <SelectField label="Registration" value={reg} onChange={setReg} options={["all", ...regs]} />
              <SelectField label="ATA Chapter" value={ata} onChange={setAta} options={["all", ...atas]} />
              <div className="grid grid-cols-2 gap-2">
                <DateField label="From" value={from} onChange={setFrom} />
                <DateField label="To" value={to} onChange={setTo} />
              </div>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setModel("all"); setReg("all"); setAta("all"); setFrom(""); setTo(""); }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* List */}
        {logs === null ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-10 text-center">
            <Wrench className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {all.length === 0
                ? "No logs found. Start logging your maintenance work."
                : "No logs match your filters."}
            </p>
            {all.length === 0 && (
              <Button asChild variant="hero" size="sm" className="mt-4">
                <Link to="/log" search={{ id: undefined }}>Log a task</Link>
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((log, i) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(i, 8) * 0.025, ease: [0.16, 1, 0.3, 1] }}
              >
                <LogCard log={log} />
              </motion.div>
            ))}
            {visible < filtered.length && (
              <div ref={sentinel} className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function uniq(arr: (string | null | undefined)[]): string[] {
  const s = new Set<string>();
  for (const v of arr) if (v && v.trim()) s.add(v.trim().toUpperCase());
  return [...s].sort();
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-lg glass-subtle px-3 text-sm text-foreground"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o === "all" ? "All" : o}</option>
        ))}
      </select>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function LogCard({ log }: { log: LogEntry }) {
  const ata = log.ata_chapter.split(" – ")[0] || log.ata_chapter || "—";
  const date = new Date(log.created_at).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
  return (
    <Link to="/log" search={{ id: log.id }}>
      <Card className="p-3.5 press">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {log.registration && <span className="reg-chip shrink-0">{log.registration}</span>}
            {log.aircraft_model && <span className="text-[11px] text-muted-foreground truncate font-medium">{log.aircraft_model}</span>}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 font-mono">
            {date}
          </span>
        </div>
        <p className="line-clamp-1 text-sm text-foreground">{log.fault_description}</p>
        {log.action_taken && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">✓ {log.action_taken}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="ata-chip">ATA {ata}</span>
          {log.time_spent_hours > 0 && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              {formatHoursMinutes(log.time_spent_hours)}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
