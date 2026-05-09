import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Plane, Clock, Wrench, Layers, Loader2, ArrowLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { fetchLogs, formatHoursMinutes, type LogEntry } from "@/lib/data";
import { motion } from "framer-motion";

export const Route = createFileRoute("/fleet")({
  head: () => ({ meta: [{ title: "Fleet – AMEL" }] }),
  component: FleetPage,
});

interface AircraftSummary {
  registration: string;
  model: string;
  totalHours: number;
  totalJobs: number;
  ataCoverage: number;
  lastWorked: string;
  logCount: number;
}

function FleetPage() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);

  useEffect(() => { fetchLogs().then(setLogs).catch(() => setLogs([])); }, []);

  const fleet = useMemo<AircraftSummary[]>(() => {
    if (!logs) return [];
    const map = new Map<string, { logs: LogEntry[] }>();
    for (const l of logs) {
      const key = (l.registration || l.aircraft_model || "Unknown").toUpperCase();
      if (!map.has(key)) map.set(key, { logs: [] });
      map.get(key)!.logs.push(l);
    }
    return [...map.entries()].map(([reg, { logs: al }]) => {
      const ataSet = new Set<string>();
      let hours = 0;
      for (const l of al) {
        const code = (l.ata_chapter || "").match(/\d{1,2}/)?.[0];
        if (code) ataSet.add(code.padStart(2, "0"));
        hours += l.time_spent_hours || 0;
      }
      const sorted = [...al].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      return {
        registration: reg,
        model: al[0]?.aircraft_model || "Unknown",
        totalHours: hours,
        totalJobs: al.length,
        ataCoverage: ataSet.size,
        lastWorked: sorted[0]?.created_at || "",
        logCount: al.length,
      };
    }).sort((a, b) => b.totalHours - a.totalHours);
  }, [logs]);

  return (
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="amel-page pt-6 relative">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/"><button className="p-2 rounded-xl glass hover:bg-primary/10 transition-colors"><ArrowLeft className="h-5 w-5" /></button></Link>
          <div>
            <p className="label-overline">Aircraft</p>
            <h1 className="page-title mt-0.5">Fleet <span className="gold-text">View</span></h1>
          </div>
        </div>
        {logs === null ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : fleet.length === 0 ? (
          <Card className="p-10 text-center">
            <Plane className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No aircraft logged yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fleet.map((ac, i) => (
              <motion.div key={ac.registration} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link to="/logs">
                  <Card className="p-4 hover:border-primary/40 transition-colors press">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="reg-chip">{ac.registration}</span>
                        <p className="mt-1 text-xs text-muted-foreground truncate">{ac.model}</p>
                      </div>
                      <Plane className="h-5 w-5 text-primary opacity-60 shrink-0 mt-0.5" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="text-center">
                        <p className="font-mono text-sm font-bold text-foreground">{formatHoursMinutes(ac.totalHours)}</p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Hours</p>
                      </div>
                      <div className="text-center">
                        <p className="font-mono text-sm font-bold text-foreground">{ac.totalJobs}</p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Jobs</p>
                      </div>
                      <div className="text-center">
                        <p className="font-mono text-sm font-bold text-foreground">{ac.ataCoverage}</p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">ATA</p>
                      </div>
                    </div>
                    {ac.lastWorked && (
                      <p className="mt-2 text-[10px] text-muted-foreground text-right">
                        Last: {new Date(ac.lastWorked).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" })}
                      </p>
                    )}
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
