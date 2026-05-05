import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusCircle, Search, BarChart3, Target, ListChecks, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fetchProfile, fetchLogs, formatHoursMinutes } from "@/lib/data";
import { computeReadiness, FRAMEWORKS, type FrameworkId } from "@/lib/licence-frameworks";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

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
  const [readinessPct, setReadinessPct] = useState<number | null>(null);
  const [framework, setFramework] = useState<FrameworkId>("NCAA");
  const [totalHours, setTotalHours] = useState<number>(0);
  const [totalJobs, setTotalJobs] = useState<number>(0);

  useEffect(() => {
    Promise.all([fetchProfile(), fetchLogs()]).then(([p, all]) => {
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
      const r = computeReadiness({ totalHours: hours, totalJobs: all.length, aircraftTypes, ataChapters }, fid);
      setReadinessPct(r.overall);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="mx-auto max-w-lg px-5 pt-10 relative">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              AM<span className="gold-text">EL</span>
            </h1>
            <p className="text-xs text-muted-foreground tracking-wide mt-0.5">Engineering memory</p>
          </div>
          <div className="h-10 w-10 rounded-2xl glass flex items-center justify-center gold-glow-sm">
            <Plane className="h-4 w-4 text-primary" />
          </div>
        </motion.div>

        {/* HERO METRIC — Total Hours */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-5"
        >
          <Card className="hero-card relative p-6 overflow-hidden">
            <Plane className="pointer-events-none absolute -right-4 -bottom-4 h-40 w-40 text-primary opacity-[0.05] -rotate-12" strokeWidth={1} />
            <p className="label-overline mb-2">Total Hours Logged</p>
            <div className="flex items-baseline gap-3">
              <AnimatedHours value={totalHours} />
              <span className="text-sm text-muted-foreground font-medium">hrs</span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono">{totalJobs}</span>
              <span>tasks recorded</span>
            </div>
          </Card>
        </motion.div>

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

        {/* Readiness widget */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mb-6">
          <Link to="/readiness" className="block">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="label-overline !text-[10px]">
                    {FRAMEWORKS[framework].name} Readiness
                  </span>
                </div>
                <span className="metric text-2xl gold-text">
                  {readinessPct ?? "—"}%
                </span>
              </div>
              <Progress value={readinessPct ?? 0} className="h-1.5" />
              <p className="mt-2 text-[11px] text-muted-foreground">Tap to see weak areas and next focus.</p>
            </Card>
          </Link>
        </motion.div>

        {/* Analytics */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-6">
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
  const display = useTransform(mv, (v) => formatHoursMinutes(v));
  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [value, mv]);
  return <motion.span className="metric gold-text text-5xl">{display}</motion.span>;
}
