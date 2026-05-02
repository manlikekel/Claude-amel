/**
 * AnalyticsDashboard — filtered analytics block for Home.
 * Single source of truth for filters; charts re-render on change.
 */
import { useEffect, useMemo, useState } from "react";
import { Clock, Wrench, Plane, Layers, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveBar } from "@nivo/bar";
import { motion, AnimatePresence } from "framer-motion";
import { fetchLogs, formatHoursMinutes, type LogEntry } from "@/lib/data";
import {
  applyFilters, overviewStats, pieData, timeSeries,
  uniqueAircraftTypes, uniqueRegistrations,
  TIME_RANGE_LABEL, type TimeRange, type AnalyticsFilters,
} from "@/lib/analytics";

const RANGES: TimeRange[] = ["24h", "1w", "1m", "1y", "5y", "all"];

const CHART_THEME = {
  text: { fill: "var(--color-foreground)", fontSize: 11 },
  axis: {
    ticks: { text: { fill: "var(--color-muted-foreground)", fontSize: 10 } },
    legend: { text: { fill: "var(--color-muted-foreground)", fontSize: 10 } },
  },
  grid: { line: { stroke: "var(--color-border)", strokeWidth: 1 } },
  tooltip: {
    container: {
      background: "var(--color-popover)",
      color: "var(--color-popover-foreground)",
      border: "1px solid var(--color-border)",
      borderRadius: 12,
      fontSize: 12,
      padding: "8px 10px",
    },
  },
  legends: { text: { fill: "var(--color-muted-foreground)", fontSize: 10 } },
} as const;

const PALETTE = [
  "var(--color-primary)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-wine)",
  "var(--color-success)",
  "var(--color-warning)",
];

export function AnalyticsDashboard() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    range: "1m",
    aircraftType: "all",
    registration: "all",
  });

  useEffect(() => {
    fetchLogs().then(setLogs).catch(() => setLogs([]));
  }, []);

  const allLogs = logs ?? [];
  const aircraftOptions = useMemo(() => uniqueAircraftTypes(allLogs), [allLogs]);
  const regOptions = useMemo(() => {
    const filtered = filters.aircraftType === "all"
      ? allLogs
      : allLogs.filter((l) => (l.aircraft_model || "").trim().toUpperCase() === filters.aircraftType.toUpperCase());
    return uniqueRegistrations(filtered);
  }, [allLogs, filters.aircraftType]);

  const filtered = useMemo(() => applyFilters(allLogs, filters), [allLogs, filters]);
  const stats = useMemo(() => overviewStats(filtered), [filtered]);
  const pie = useMemo(() => pieData(filtered, filters), [filtered, filters]);
  const series = useMemo(() => timeSeries(filtered, filters.range), [filtered, filters.range]);

  if (logs === null) {
    return (
      <Card className="flex items-center justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top metric */}
      <Card className="p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Hours Worked</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={stats.totalHours}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mt-1 text-4xl font-bold text-primary drop-shadow-[0_0_12px_oklch(0.78_0.12_80/0.35)]"
          >
            {formatHoursMinutes(stats.totalHours)}
          </motion.p>
        </AnimatePresence>
        <p className="mt-1 text-[11px] text-muted-foreground">{TIME_RANGE_LABEL[filters.range]} · {filtered.length} task{filtered.length === 1 ? "" : "s"}</p>
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <FilterRow label="Time Range">
          {RANGES.map((r) => (
            <Pill key={r} active={filters.range === r} onClick={() => setFilters((f) => ({ ...f, range: r }))}>
              {TIME_RANGE_LABEL[r]}
            </Pill>
          ))}
        </FilterRow>
        <FilterRow label="Aircraft Type">
          <Pill active={filters.aircraftType === "all"} onClick={() => setFilters((f) => ({ ...f, aircraftType: "all", registration: "all" }))}>All</Pill>
          {aircraftOptions.map((a) => (
            <Pill key={a} active={filters.aircraftType === a} onClick={() => setFilters((f) => ({ ...f, aircraftType: a, registration: "all" }))}>
              {a}
            </Pill>
          ))}
        </FilterRow>
        <FilterRow label="Registration">
          <Pill active={filters.registration === "all"} onClick={() => setFilters((f) => ({ ...f, registration: "all" }))}>All</Pill>
          {regOptions.map((r) => (
            <Pill key={r} active={filters.registration === r} onClick={() => setFilters((f) => ({ ...f, registration: r }))}>
              {r}
            </Pill>
          ))}
        </FilterRow>
      </Card>

      {/* Pie chart */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Man-hours by {pie.dimension}</p>
        </div>
        <div className="h-64 w-full">
          {pie.data.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsivePie
              data={pie.data}
              margin={{ top: 12, right: 12, bottom: 24, left: 12 }}
              innerRadius={0.55}
              padAngle={1.2}
              cornerRadius={4}
              colors={PALETTE}
              borderWidth={0}
              activeOuterRadiusOffset={6}
              arcLinkLabelsSkipAngle={12}
              arcLinkLabelsColor="var(--color-muted-foreground)"
              arcLinkLabelsTextColor="var(--color-foreground)"
              arcLinkLabelsThickness={1}
              arcLabelsSkipAngle={16}
              arcLabelsTextColor="var(--color-primary-foreground)"
              theme={CHART_THEME as any}
              motionConfig="gentle"
              animate
              tooltip={({ datum }) => (
                <div style={CHART_THEME.tooltip.container as any}>
                  <strong style={{ color: datum.color }}>{datum.label}</strong>: {formatHoursMinutes(Number(datum.value))}
                </div>
              )}
            />
          )}
        </div>
      </Card>

      {/* Time series */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hours over time</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{series.granularity}</p>
        </div>
        <div className="h-56 w-full">
          {series.points.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveBar
              data={series.points.map((p) => ({ x: p.x, hours: p.y }))}
              keys={["hours"]}
              indexBy="x"
              margin={{ top: 8, right: 12, bottom: 32, left: 32 }}
              padding={0.3}
              colors={["var(--color-primary)"]}
              borderRadius={4}
              theme={CHART_THEME as any}
              axisBottom={{ tickSize: 0, tickPadding: 6, tickRotation: 0 }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
              enableGridX={false}
              enableLabel={false}
              animate
              motionConfig="gentle"
              tooltip={({ value, indexValue, color }) => (
                <div style={CHART_THEME.tooltip.container as any}>
                  <strong style={{ color }}>{indexValue}</strong>: {formatHoursMinutes(Number(value))}
                </div>
              )}
            />
          )}
        </div>
      </Card>

      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-3">
        <OverviewCard icon={Wrench} label="Total Tasks" value={stats.totalTasks} />
        <OverviewCard icon={Plane} label="Total Aircraft" value={stats.totalAircraft} />
        <OverviewCard icon={Clock} label="Total Hours" value={formatHoursMinutes(stats.totalHours)} />
        <OverviewCard icon={Layers} label="ATA Coverage" value={stats.ataCoverage} />
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all active:scale-[0.97] ${
        active ? "gold-gradient text-primary-foreground gold-glow-sm" : "glass-subtle text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function OverviewCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number | string }) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl glass-subtle">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.p
            key={String(value)}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="text-base font-bold text-foreground truncate"
          >
            {value}
          </motion.p>
        </AnimatePresence>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
      No data for this filter yet.
    </div>
  );
}
