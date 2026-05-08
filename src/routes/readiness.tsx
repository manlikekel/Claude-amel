import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Target, TrendingUp, AlertTriangle, CheckCircle2, CalendarClock, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fetchProfile, fetchLogs, saveProfile, type ProfileData, type LogEntry } from "@/lib/data";
import { computeReadiness, FRAMEWORKS, type FrameworkId, type ReadinessResult } from "@/lib/licence-frameworks";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, subWeeks, startOfWeek } from "date-fns";

export const Route = createFileRoute("/readiness")({
  head: () => ({
    meta: [
      { title: "Licence Readiness – AMEL" },
      { name: "description", content: "Track your readiness for NCAA, EASA Part-66 or FAA A&P licence." },
    ],
  }),
  component: ReadinessPage,
});

interface ProgressPoint { week: string; pct: number }

function buildProgressHistory(logs: LogEntry[], frameworkId: FrameworkId): ProgressPoint[] {
  if (logs.length === 0) return [];
  const points: ProgressPoint[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const cutoff = subWeeks(now, i);
    const subset = logs.filter((l) => new Date(l.created_at) <= cutoff);
    const aircraftTypes = new Set<string>();
    const ataChapters = new Set<string>();
    let hours = 0;
    for (const l of subset) {
      if (l.aircraft_model) aircraftTypes.add(l.aircraft_model.trim().toUpperCase());
      const code = (l.ata_chapter || "").match(/\d{1,2}/)?.[0];
      if (code) ataChapters.add(code.padStart(2, "0"));
      hours += l.time_spent_hours || 0;
    }
    const r = computeReadiness({ totalHours: hours, totalJobs: subset.length, aircraftTypes, ataChapters }, frameworkId);
    points.push({ week: format(startOfWeek(cutoff), "MMM d"), pct: r.overall });
  }
  return points;
}

function estimateCompletionDate(logs: LogEntry[], result: ReadinessResult): string | null {
  if (result.overall >= 100) return null;
  const eightWeeksAgo = subWeeks(new Date(), 8);
  const recent = logs.filter((l) => new Date(l.created_at) >= eightWeeksAgo);
  const recentHours = recent.reduce((s, l) => s + (l.time_spent_hours || 0), 0);
  const hoursPerWeek = recentHours / 8;
  if (hoursPerWeek <= 0) return null;
  const remainingHours = Math.max(0, result.buckets.hours.required - result.buckets.hours.value);
  const weeksNeeded = remainingHours / hoursPerWeek;
  const completionDate = new Date();
  completionDate.setDate(completionDate.getDate() + Math.ceil(weeksNeeded * 7));
  return format(completionDate, "MMM yyyy");
}

function ReadinessPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [framework, setFramework] = useState<FrameworkId>("NCAA");
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [progressHistory, setProgressHistory] = useState<ProgressPoint[]>([]);
  const [completionDate, setCompletionDate] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [p, logs] = await Promise.all([fetchProfile(), fetchLogs()]);
      setProfile(p);
      setAllLogs(logs);
      const startingFramework = (p.target_framework as FrameworkId) || "NCAA";
      setFramework(startingFramework);
      const aircraftTypes = new Set<string>();
      const ataChapters = new Set<string>();
      let hours = 0;
      for (const l of logs) {
        if (l.aircraft_model) aircraftTypes.add(l.aircraft_model.trim().toUpperCase());
        const code = (l.ata_chapter || "").match(/\d{1,2}/)?.[0];
        if (code) ataChapters.add(code.padStart(2, "0"));
        hours += l.time_spent_hours || 0;
      }
      const r = computeReadiness(
        { totalHours: hours, totalJobs: logs.length, aircraftTypes, ataChapters },
        startingFramework,
      );
      setResult(r);
      setProgressHistory(buildProgressHistory(logs, startingFramework));
      setCompletionDate(estimateCompletionDate(logs, r));
      setLoading(false);
    })();
  }, []);

  const switchFramework = async (id: FrameworkId) => {
    if (!result || !profile) return;
    setFramework(id);
    const logs = allLogs.length > 0 ? allLogs : await fetchLogs();
    const aircraftTypes = new Set<string>();
    const ataChapters = new Set<string>();
    let hours = 0;
    for (const l of logs) {
      if (l.aircraft_model) aircraftTypes.add(l.aircraft_model.trim().toUpperCase());
      const code = (l.ata_chapter || "").match(/\d{1,2}/)?.[0];
      if (code) ataChapters.add(code.padStart(2, "0"));
      hours += l.time_spent_hours || 0;
    }
    const r = computeReadiness({ totalHours: hours, totalJobs: logs.length, aircraftTypes, ataChapters }, id);
    setResult(r);
    setProgressHistory(buildProgressHistory(logs, id));
    setCompletionDate(estimateCompletionDate(logs, r));

    try {
      await saveProfile({ ...profile, target_framework: id });
      toast.success(`Target set to ${FRAMEWORKS[id].name}`);
    } catch (e: any) { toast.error(e?.message ?? "Couldn't save"); }
  };

  if (loading || !result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav relative overflow-hidden depth-vignette">
      <div className="mx-auto max-w-lg px-5 pt-6 relative">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div>
            <p className="label-overline">Compliance</p>
            <h1 className="page-title mt-0.5 text-2xl">Licence <span className="gold-text">Readiness</span></h1>
            <p className="page-subtitle">{result.framework.fullName}</p>
          </div>
        </div>

        {/* Framework switcher */}
        <div className="mb-5 flex gap-1.5">
          {(Object.keys(FRAMEWORKS) as FrameworkId[]).map((id) => (
            <button
              key={id}
              onClick={() => switchFramework(id)}
              data-active={framework === id}
              className="seg-pill flex-1 press"
            >
              {FRAMEWORKS[id].name}
            </button>
          ))}
        </div>

        {/* Overall score */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="hero-card p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="label-overline !text-[10px]">Overall Readiness</span>
              </div>
              <span className="metric gold-text text-4xl">
                {result.overall}%
              </span>
            </div>
            <Progress value={result.overall} className="h-2.5" />
            <p className="mt-3 text-sm text-foreground/90">
              You have covered <span className="font-mono text-primary">{result.overall}%</span> of your required experience profile for {result.framework.name}.
            </p>
            {completionDate && (
              <div className="mt-3 flex items-center gap-2 rounded-xl glass-subtle px-3 py-2">
                <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs text-foreground/80">
                  At current pace, ready by <span className="font-semibold text-primary">{completionDate}</span>
                </p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Progress over time */}
        {progressHistory.length > 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <Card className="p-4 mb-5">
              <p className="label-overline mb-3">Progress Over Time</p>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressHistory} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="week" tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 11 }}
                      formatter={(v: number) => [`${v}%`, "Readiness"]}
                    />
                    <Line type="monotone" dataKey="pct" stroke="var(--color-primary)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "var(--color-primary)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Buckets */}
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coverage Breakdown</h2>
        <div className="mb-5 grid grid-cols-1 gap-2.5">
          <BucketRow label="Practical Hours" value={result.buckets.hours.value} required={result.buckets.hours.required} pct={result.buckets.hours.pct} suffix="h" />
          <BucketRow label="ATA Chapters Touched" value={result.buckets.ataCoverage.value} required={result.buckets.ataCoverage.required} pct={result.buckets.ataCoverage.pct} />
          <BucketRow label="Aircraft Types" value={result.buckets.aircraftTypes.value} required={result.buckets.aircraftTypes.required} pct={result.buckets.aircraftTypes.pct} />
          <BucketRow label="Recorded Jobs" value={result.buckets.jobs.value} required={result.buckets.jobs.required} pct={result.buckets.jobs.pct} />
        </div>

        {/* Next focus */}
        <Card className="p-4 mb-5 border-primary/30">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Recommended Next Focus</h3>
              <p className="text-sm text-foreground">{result.nextFocus}</p>
            </div>
          </div>
        </Card>

        {/* Weak areas */}
        {result.weakAreas.length > 0 && (
          <>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weak Areas</h2>
            <div className="mb-5 flex flex-col gap-2">
              {result.weakAreas.map((w) => (
                <Card key={w.label} className="p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-foreground">{w.label}</span>
                    <span className="text-xs text-muted-foreground">{w.pct}%</span>
                  </div>
                  <Progress value={w.pct} className="h-1.5 mb-2" />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground flex-1">{w.advice}</p>
                    <Link to="/log" search={{ id: undefined }}>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px] text-primary px-2 shrink-0">
                        <PlusCircle className="h-3 w-3" />
                        Log now
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Missing core ATA */}
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Missing Core ATA Chapters</h2>
        {result.missingAtaChapters.length === 0 ? (
          <Card className="p-4 flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            All core ATA chapters covered.
          </Card>
        ) : (
          <Card className="p-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {result.missingAtaChapters.length} core chapter{result.missingAtaChapters.length === 1 ? "" : "s"} not yet logged.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.missingAtaChapters.map((c) => (
                <span key={c} className="inline-flex items-center rounded-full glass-subtle px-2.5 py-0.5 text-xs font-semibold text-primary">
                  ATA {c}
                </span>
              ))}
            </div>
          </Card>
        )}

        <p className="mt-6 text-[10px] text-muted-foreground text-center">{result.framework.notes}</p>
      </div>
    </div>
  );
}

function BucketRow({ label, value, required, pct, suffix = "" }: { label: string; value: number; required: number; pct: number; suffix?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {value}{suffix} / {required}{suffix} · {pct}%
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </Card>
  );
}
