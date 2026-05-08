import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Search, ListChecks, Target, MoreHorizontal } from "lucide-react";
import { motion, LayoutGroup } from "framer-motion";
import { useEffect } from "react";
import { fetchLicences } from "@/lib/data";
import { useState } from "react";
import { differenceInDays, parseISO } from "date-fns";

const navItems = [
  { to: "/" as const, icon: Home, label: "Home" },
  { to: "/logs" as const, icon: ListChecks, label: "Logs" },
  { to: "/search" as const, icon: Search, label: "Search" },
  { to: "/readiness" as const, icon: Target, label: "Readiness" },
  { to: "/account" as const, icon: MoreHorizontal, label: "More" },
] as const;

type NavTo = typeof navItems[number]["to"];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [readinessBadge, setReadinessBadge] = useState(false);

  useEffect(() => {
    fetchLicences().then((licences) => {
      const soon = licences.some((l) => {
        if (!l.expiry_date) return false;
        try {
          return differenceInDays(parseISO(l.expiry_date), new Date()) <= 60;
        } catch { return false; }
      });
      setReadinessBadge(soon);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const routes: Record<string, NavTo> = { "1": "/", "2": "/logs", "3": "/search", "4": "/readiness", "5": "/account" };
      const dest = routes[e.key];
      if (dest) navigate({ to: dest });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return (
    <nav aria-label="Main navigation" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md safe-area-pb">
      <div className="glass-nav rounded-[28px] px-2 py-2.5">
        <LayoutGroup id="bottom-nav">
          <div className="flex items-center justify-around">
            {navItems.map((item) => {
              const isActive =
                item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
              const showBadge = item.to === "/readiness" && readinessBadge;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 text-[10px] transition-all press ${
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  <span className="relative">
                    <item.icon
                      className={`h-5 w-5 transition-all ${
                        isActive ? "drop-shadow-[0_0_10px_color-mix(in_oklab,var(--primary)_70%,transparent)]" : ""
                      }`}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    {showBadge && <span className="notif-dot" aria-hidden="true" />}
                  </span>
                  <span className="font-medium tracking-wide relative">{item.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-dot"
                      transition={{ type: "spring", stiffness: 480, damping: 34 }}
                      className="absolute -bottom-1 h-[3px] w-[3px] rounded-full bg-primary shadow-[0_0_8px_var(--primary)]"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </LayoutGroup>
      </div>
    </nav>
  );
}
