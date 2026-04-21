import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusCircle, Search, BarChart3, Wrench, Clock, Plane, Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fetchRecentLogs, computeStats, fetchProfile, fetchLogs, formatHoursMinutes, type LogEntry, type Stats } from "@/lib/data";
import { computeReadiness, FRAMEWORKS, type FrameworkId } from "@/lib/licence-frameworks";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AMEL – Aircraft Maintenance Engineer Logbook" },
      { name: "description", content: "Log, track, and search aircraft maintenance faults intelligently." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [recent, setRecent] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ totalLogs: 0, aircraftTypes: 0, totalHours: 0, ataChapters: 0 });
  const [readinessPct, setReadinessPct] = useState<number | null>(null);
  const [framework, setFramework] = useState<FrameworkId>("NCAA");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchRecentLogs(5), computeStats(), fetchProfile(), fetchLogs()]).then(([r, s, p, all]) => {
      setRecent(r);
      setStats(s);
      const fid = (p.target_framework as FrameworkId) || "NCAA";
      setFramework(fid);
      const aircraftTypes = new Set<string>();
      const ataChapters = new Set<string>();
      let hours = 0;
      for (const l of all) {
        if (l.aircraft_model) aircraftTypes.add(l.aircraft_model.trim().toUpperCase());
        const code = (l.ata_chapter || "").match(/\d{1,2}/)?.[0];
        if (code) ataChapters.add(code.padStart(2, "0"));
        hours += l.time_spent_hours || 0;
      }
      const r2 = computeReadiness({ totalHours: hours, totalJobs: all.length, aircraftTypes, ataChapters }, fid);
      setReadinessPct(r2.overall);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background pb-32 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-96 rounded-full bg-primary/8 blur-[100px]" />
      <div className="pointer-events-none absolute top-1/3 -right-20 h-48 w-48 rounded-full bg-primary/5 blur-[80px]" />

      <div className="mx-auto max-w-lg px-5 pt-10 relative">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <h1 className="text-3xl font-bold tracking-tight text-primary drop-shadow-[0_0_12px_oklch(0.78_0.12_80/0.3)]">AMEL</h1>
          <p className="text-sm text-muted-foreground">Your engineering memory</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-7 flex flex-col gap-3"
        >
          <Button variant="hero" size="xl" className="w-full justify-start gap-3" asChild>
            <Link to="/log" search={{ id: undefined }}>
              <PlusCircle className="h-5 w-5" />
              Log New Task
            </Link>
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="action" size="lg" className="justify-start gap-2" asChild>
              <Link to="/search">
                <Search className="h-4 w-4 text-primary" />
                Find a Fault
              </Link>
            </Button>
            <Button variant="action" size="lg" className="justify-start gap-2" asChild>
              <Link to="/experience">
                <BarChart3 className="h-4 w-4 text-primary" />
                Experience
              </Link>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-7 grid grid-cols-3 gap-3"
        >
          <StatCard icon={Wrench} value={stats.totalLogs} label="Jobs" />
          <StatCard icon={Plane} value={stats.aircraftTypes} label="Aircraft" />
          <StatCard icon={Clock} value={formatHoursMinutes(stats.totalHours)} label="Hours" />
        </motion.div>

        {/* Licence readiness widget */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mb-7">
          <Link to="/readiness" className="block">
            <Card className="p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {FRAMEWORKS[framework].name} Readiness
                  </span>
                </div>
                <span className="text-2xl font-bold text-primary drop-shadow-[0_0_8px_oklch(0.78_0.12_80/0.4)]">
                  {readinessPct ?? "—"}%
                </span>
              </div>
              <Progress value={readinessPct ?? 0} className="h-1.5" />
              <p className="mt-2 text-[11px] text-muted-foreground">Tap to see weak areas and next focus.</p>
            </Card>
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Work
          </h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : recent.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-8 text-center">
              <Wrench className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No logs yet. Tap "Log New Task" above.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {recent.map((log) => (
                <LogCard key={log.id} log={log} />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: React.ElementType; value: number | string; label: string }) {
  return (
    <Card className="flex flex-col items-center p-4">
      <Icon className="mb-1.5 h-4 w-4 text-primary" />
      <span className="text-xl font-bold text-foreground">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </Card>
  );
}

function LogCard({ log }: { log: LogEntry }) {
  const ata = log.ata_chapter.split(" – ")[0] || log.ata_chapter || "—";
  const hours = log.time_spent_hours ? formatHoursMinutes(log.time_spent_hours) : "";
  return (
    <Link to="/log" search={{ id: log.id }}>
      <Card className="p-3 hover:border-primary/40 transition-colors">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-primary">
            {[log.registration, log.aircraft_model].filter(Boolean).join(" · ") || "Aircraft"} · ATA {ata}
          </span>
          {hours && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {log.is_recurring ? "Recurring · " : ""}{hours}
            </span>
          )}
        </div>
        <p className="line-clamp-1 text-sm text-foreground">{log.fault_description}</p>
        {log.action_taken && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">✓ {log.action_taken}</p>
        )}
      </Card>
    </Link>
  );
}
