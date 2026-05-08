import { Link, useLocation } from "@tanstack/react-router";
import {
  Home, Search, ListChecks, Target, Plane,
  Cog, ShieldAlert, Wrench, GraduationCap, Briefcase, Settings, BadgeCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchLicences } from "@/lib/data";
import { differenceInDays, parseISO } from "date-fns";

const PRIMARY = [
  { to: "/" as const, icon: Home, label: "Home" },
  { to: "/logs" as const, icon: ListChecks, label: "Logs" },
  { to: "/search" as const, icon: Search, label: "Search" },
  { to: "/readiness" as const, icon: Target, label: "Readiness" },
  { to: "/experience" as const, icon: BadgeCheck, label: "Experience" },
];

const TOOLKIT = [
  { to: "/components" as const, icon: Cog, label: "Components" },
  { to: "/ad-sb" as const, icon: ShieldAlert, label: "AD / SB" },
  { to: "/tools" as const, icon: Wrench, label: "Tool Cal." },
  { to: "/cpd" as const, icon: GraduationCap, label: "CPD" },
  { to: "/type-ratings" as const, icon: Plane, label: "Type Ratings" },
  { to: "/jobs" as const, icon: Briefcase, label: "Jobs" },
];

export function SideNav() {
  const location = useLocation();
  const [readinessBadge, setReadinessBadge] = useState(false);

  useEffect(() => {
    fetchLicences().then((licences) => {
      const soon = licences.some((l) => {
        if (!l.expiry_date) return false;
        try { return differenceInDays(parseISO(l.expiry_date), new Date()) <= 60; }
        catch { return false; }
      });
      setReadinessBadge(soon);
    }).catch(() => {});
  }, []);

  const isActive = (path: string) => path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <aside
      aria-label="Sidebar navigation"
      className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col glass-nav border-r border-glass-border z-40"
    >
      <div className="px-6 pt-7 pb-5">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl glass flex items-center justify-center gold-glow-sm">
            <Plane className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight leading-none">
              AM<span className="gold-text">EL</span>
            </h1>
            <p className="text-[10px] text-muted-foreground tracking-wider mt-1">Engineering memory</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Primary</p>
        <ul className="flex flex-col gap-0.5">
          {PRIMARY.map((item) => {
            const active = isActive(item.to);
            const showBadge = item.to === "/readiness" && readinessBadge;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all press ${
                    active
                      ? "bg-primary/15 text-primary border border-primary/25 shadow-amel-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-[oklch(1_0_0/0.04)]"
                  }`}
                >
                  <span className="relative">
                    <item.icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.8} />
                    {showBadge && <span className="notif-dot" />}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="px-3 pt-5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Maintenance</p>
        <ul className="flex flex-col gap-0.5">
          {TOOLKIT.map((item) => {
            const active = isActive(item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all press ${
                    active
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-[oklch(1_0_0/0.04)]"
                  }`}
                >
                  <item.icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.8} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-glass-border px-3 py-3">
        <Link
          to="/account"
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all press ${
            isActive("/account")
              ? "bg-primary/15 text-primary border border-primary/25"
              : "text-muted-foreground hover:text-foreground hover:bg-[oklch(1_0_0/0.04)]"
          }`}
        >
          <Settings className="h-4 w-4" />
          <span className="font-medium">Account & Settings</span>
        </Link>
      </div>
    </aside>
  );
}
