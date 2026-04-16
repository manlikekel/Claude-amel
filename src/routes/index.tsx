import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { PlusCircle, Search, BarChart3, Wrench, Clock, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRecentLogs, getStats, type LogEntry } from "@/lib/store";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AMEL – Aircraft Maintenance Engineer Logbook" },
      { name: "description", content: "Log, track, and search aircraft maintenance faults intelligently." },
      { property: "og:title", content: "AMEL – Aircraft Maintenance Engineer Logbook" },
      { property: "og:description", content: "Your engineering memory for aircraft maintenance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [recent, setRecent] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({ totalLogs: 0, aircraftTypes: 0, totalHours: 0, ataChapters: 0 });

  useEffect(() => {
    setRecent(getRecentLogs(5));
    setStats(getStats());
  }, []);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-lg px-5 pt-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-primary">AMEL</h1>
          <p className="text-sm text-muted-foreground">Your engineering memory</p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 flex flex-col gap-3"
        >
          <Button variant="hero" size="xl" className="w-full justify-start gap-3" asChild>
            <Link to="/log">
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

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8 grid grid-cols-3 gap-3"
        >
          <StatCard icon={Wrench} value={stats.totalLogs} label="Jobs" />
          <StatCard icon={Plane} value={stats.aircraftTypes} label="Aircraft" />
          <StatCard icon={Clock} value={stats.totalHours} label="Hours" />
        </motion.div>

        {/* Recent Work */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Work
          </h2>
          {recent.length === 0 ? (
            <Card className="flex flex-col items-center justify-center border-dashed p-8 text-center">
              <Wrench className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No logs yet. Start by logging your first task.</p>
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

function StatCard({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <Card className="flex flex-col items-center p-3">
      <Icon className="mb-1 h-4 w-4 text-primary" />
      <span className="text-xl font-bold text-foreground">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </Card>
  );
}

function LogCard({ log }: { log: LogEntry }) {
  const ata = log.ata_chapter.split(" – ")[0] || log.ata_chapter;
  const hours = log.time_spent ? `${log.time_spent}h` : "";

  return (
    <Card className="p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-primary">
          {log.aircraft_type} · ATA {ata}
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
  );
}
