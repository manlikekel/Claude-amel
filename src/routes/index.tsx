import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusCircle, Search, BarChart3, Target, ListChecks, Plane, Flame, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fetchProfile, fetchLogs, fetchRecentLogs, formatHoursMinutes, type LogEntry } from "@/lib/data";
import { computeReadiness, FRAMEWORKS, type FrameworkId } from "@/lib/licence-frameworks";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AMEL – Aircraft Maintenance Engineer Logbook" },
      { name: "description", content: "Log, track, and search aircraft maintenance faults intelligently." },
    ],
  }),
  component: Dashboard,
});

function computeStreak(logs: LogEntry[]): number {
  if (logs.length === 0) return 0;
  const days = new Set(logs.map((l) => new Date(l.created_at).toDateString()));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (days.has(d.toDateString())) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

function Dashboard() {
  const [readinessPct, setReadinessPct] = useState<number | null>(null);
  const [framework, setFramework] = useState<FrameworkId>("NCAA");
  const [totalHours, setTotalHours] = useState<number>(0);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [streak, setStreak] = useState(0);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [milestone, setMilestone] = useState<{ label: string; remaining: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const [p, all, recent] = await Promise.all([fetchProfile(), fetchLogs(), fetchRecentLogs(3)]);
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
    setTotalHours(hours);
    setTotalJobs(all.length);
    setStreak(computeStreak(all));
    setRecentLogs(recent);
    const r = computeReadiness({ totalHours: hours, totalJobs: all.length, aircraftTypes, ataChapters }, fid);
    setReadinessPct(r.overall);

    // Find closest incomplete requirement
    const fw = FRAMEWORKS[fid];
    const buckets = [
      { label: "Hours needed", remaining: `${Math.max(0, fw.requiredHours - Math.round(hours))}h remaining`, pct: Math.min(100, (hours / fw.requiredHours) * 100) },
      { label: "Jobs needed", remaining: `${Math.max(0, fw.requiredJobs - all.length)} jobs remaining`, pct: Math.min(100, (all.length / fw.requiredJobs) * 100) },
      { label: "ATA chapters", remaining: `${Math.max(0, fw.requiredAtaCoverage - ataChapters.size)} chapters remaining`, pct: Math.min(100, (ataChapters.size / fw.requiredAtaCoverage) * 100) },
    ].filter((b) => b.pct < 100).sort((a, b) => b.pct - a.pct);
    setMilestone(buckets[0] ?? null);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="amel-page pt-6 sm:pt-10 relative">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              AM<span className="gold-text">EL</span>
            </h1>
            <p className="text-xs text-muted-foreground tracking-wide mt-0.5">Engineering memory</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleRefresh} aria-label="Refresh dashboard">
              <RefreshCw className={`h-4 w-4${refreshing ? " animate-spin" : ""}`} />
            </Button>
            <div className="h-10 w-10 rounded-2xl glass flex items-center justify-center gold-glow-sm">
              <Plane className="h-4 w-4 text-primary" />
            </div>
          </div>
        </motion.div>

        {/* HERO + READINESS row: stacks on mobile, 3-col on tablet+ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 mb-5">
          {/* HERO METRIC — Total Hours (spans 2/3 on desktop) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="md:col-span-2"
          >
            <Card className="hero-card relative p-6 overflow-hidden h-full">
              <Plane className="pointer-events-none absolute -right-4 -bottom-4 h-40 w-40 text-primary opacity-[0.05] -rotate-12" strokeWidth={1} />
              <div className="flex items-start justify-between mb-2">
                <p className="label-overline">Total Hours Logged</p>
                {streak > 1 && (
                  <span className="streak-chip">
                    <Flame className="h-3 w-3" />
                    {streak}-day streak
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-3">
                <AnimatedHours value={totalHours} />
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono">{totalJobs}</span>
                <span>tasks recorded</span>
              </div>
            </Card>
          </motion.div>

          {/* Readiness widget */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
            <Link to="/readiness" className="block h-full">
              <Card className="p-4 h-full hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="label-overline !text-[10px]">
                      {FRAMEWORKS[framework].name} Readiness
                    </span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="metric text-3xl gold-text">{readinessPct ?? "—"}</span>
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <Progress value={readinessPct ?? 0} className="h-1.5" />
                <p className="mt-2 text-[11px] text-muted-foreground">Tap for weak areas & next focus.</p>
              </Card>
            </Link>
          </motion.div>
        </div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6 flex flex-col gap-3"
        >
          <Button variant="hero" size="xl" className="w-full justify-start gap-3" asChild>
            <Link to="/log" search={{ id: undefined }}>
              <PlusCircle className="h-5 w-5" />
              Log New Task
            </Link>
          </Button>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
            <Button variant="action" size="lg" className="justify-start gap-2" asChild>
              <Link to="/fleet"><Plane className="h-4 w-4 text-primary" />Fleet</Link>
            </Button>
          </div>
        </motion.div>

        {/* Next milestone */}
        {milestone && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }} className="mb-5">
            <Link to="/readiness" className="block">
              <Card className="p-4 border-primary/20 hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="label-overline mb-0.5">{milestone.label}</p>
                    <p className="text-sm font-semibold text-foreground">{milestone.remaining}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                </div>
              </Card>
            </Link>
          </motion.div>
        )}

        {/* Recent activity — 3-col grid on tablet+ */}
        {recentLogs.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</h2>
              <Link to="/logs" className="text-[11px] text-primary hover:underline">View all</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {recentLogs.map((log) => (
                <Link key={log.id} to="/log" search={{ id: log.id }}>
                  <Card className="p-3 hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="reg-chip text-[10px]">{log.registration || log.aircraft_model || "—"}</span>
                      {log.ata_chapter && (
                        <span className="ata-chip">{log.ata_chapter.split(" ")[0]}</span>
                      )}
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground line-clamp-1">{log.fault_description || "—"}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Analytics */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mb-6">
          <AnalyticsDashboard />
        </motion.div>

        {/* View All Logs link */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <Button asChild variant="action" size="lg" className="w-full justify-between">
            <Link to="/logs">
              <span className="inline-flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                View All Logs
              </span>
              <span className="text-primary">→</span>
            </Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

function AnimatedHours({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const hrs = useTransform(mv, (v) => String(Math.floor(v)));
  const mins = useTransform(mv, (v) => {
    const m = Math.round((v - Math.floor(v)) * 60);
    return m === 60 ? "00" : String(m).padStart(2, "0");
  });
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return controls.stop;
  }, [value, mv]);
  return (
    <span className="flex items-baseline gap-1 flex-wrap">
      <motion.span className="metric gold-text text-5xl leading-none">{hrs}</motion.span>
      <span className="text-2xl font-bold text-primary/80 leading-none">h</span>
      <motion.span className="metric gold-text text-3xl leading-none">{mins}</motion.span>
      <span className="text-lg font-bold text-primary/80 leading-none">m</span>
    </span>
  );
}
