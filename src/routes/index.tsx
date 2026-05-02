import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusCircle, Search, BarChart3, Target, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fetchProfile, fetchLogs } from "@/lib/data";
import { computeReadiness, FRAMEWORKS, type FrameworkId } from "@/lib/licence-frameworks";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
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
  const [readinessPct, setReadinessPct] = useState<number | null>(null);
  const [framework, setFramework] = useState<FrameworkId>("NCAA");

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
      const r = computeReadiness({ totalHours: hours, totalJobs: all.length, aircraftTypes, ataChapters }, fid);
      setReadinessPct(r.overall);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-96 rounded-full bg-primary/8 blur-[100px]" />
      <div className="pointer-events-none absolute top-1/3 -right-20 h-48 w-48 rounded-full bg-primary/5 blur-[80px]" />

      <div className="mx-auto max-w-lg px-5 pt-10 relative">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-primary drop-shadow-[0_0_12px_oklch(0.78_0.12_80/0.3)]">AMEL</h1>
          <p className="text-sm text-muted-foreground">Your engineering memory</p>
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
