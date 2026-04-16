import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, FileText, Plane, Wrench, BookOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getExperienceData, getStats } from "@/lib/store";
import { motion } from "framer-motion";

export const Route = createFileRoute("/experience")({
  head: () => ({
    meta: [
      { title: "My Experience – AMEL" },
      { name: "description", content: "Track your aircraft maintenance experience." },
    ],
  }),
  component: ExperiencePage,
});

function ExperiencePage() {
  const [data, setData] = useState<ReturnType<typeof getExperienceData> | null>(null);
  const [stats, setStats] = useState({ totalLogs: 0, aircraftTypes: 0, totalHours: 0, ataChapters: 0 });

  useEffect(() => {
    setData(getExperienceData());
    setStats(getStats());
  }, []);

  const aircraftEntries = data ? Object.entries(data.byAircraft) : [];
  const ataEntries = data ? Object.entries(data.byAta).sort((a, b) => b[1] - a[1]).slice(0, 12) : [];
  const maxAta = ataEntries.length > 0 ? Math.max(...ataEntries.map(([, v]) => v)) : 1;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-lg px-5 pt-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-foreground">My Experience</h1>
        </div>

        {/* Summary */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 grid grid-cols-3 gap-3">
          <StatBox icon={Wrench} value={stats.totalLogs} label="Total Jobs" />
          <StatBox icon={Plane} value={stats.aircraftTypes} label="Aircraft" />
          <StatBox icon={BookOpen} value={stats.ataChapters} label="ATA Chapters" />
        </motion.div>

        {/* Aircraft Hours */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Aircraft Hours</h2>
          {aircraftEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {aircraftEntries.map(([type, info]) => {
                const maxHours = Math.max(...aircraftEntries.map(([, i]) => i.hours), 1);
                const pct = (info.hours / maxHours) * 100;
                return (
                  <Card key={type} className="p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{type}</span>
                      <span className="text-xs text-muted-foreground">
                        {info.hours}h · {info.jobs} jobs
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <motion.div
                        className="h-2 rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* ATA Coverage */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">ATA Coverage</h2>
          {ataEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {ataEntries.map(([ata, count]) => (
                <div key={ata} className="flex items-center gap-3">
                  <span className="w-8 text-right text-xs font-mono text-muted-foreground">{ata}</span>
                  <div className="flex-1">
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <motion.div
                        className="h-1.5 rounded-full bg-primary/70"
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / maxAta) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                  <span className="w-6 text-xs text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Generate CV */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Button variant="hero" size="xl" className="w-full gap-2">
            <FileText className="h-5 w-5" />
            Generate CV
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <Card className="flex flex-col items-center p-4">
      <Icon className="mb-1.5 h-5 w-5 text-primary" />
      <span className="text-2xl font-bold text-foreground">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </Card>
  );
}
