import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Search, ListChecks, Target, MoreHorizontal } from "lucide-react";
import { motion, LayoutGroup } from "framer-motion";
import { useEffect, useState } from "react";
import { fetchLicences } from "@/lib/data";
import { differenceInDays, parseISO } from "date-fns";

const navItems = [
  {
    to: "/" as const,
    icon: Home,
    label: "Home",
    color: "oklch(0.78 0.17 55)",       // amber-gold
    glow:  "oklch(0.78 0.17 55 / 0.5)",
    bg:    "oklch(0.78 0.17 55 / 0.15)",
  },
  {
    to: "/logs" as const,
    icon: ListChecks,
    label: "Logs",
    color: "oklch(0.72 0.18 230)",      // sky-blue
    glow:  "oklch(0.72 0.18 230 / 0.5)",
    bg:    "oklch(0.72 0.18 230 / 0.15)",
  },
  {
    to: "/search" as const,
    icon: Search,
    label: "Search",
    color: "oklch(0.75 0.19 145)",      // emerald
    glow:  "oklch(0.75 0.19 145 / 0.5)",
    bg:    "oklch(0.75 0.19 145 / 0.15)",
  },
  {
    to: "/readiness" as const,
    icon: Target,
    label: "Readiness",
    color: "oklch(0.72 0.2 300)",       // violet
    glow:  "oklch(0.72 0.2 300 / 0.5)",
    bg:    "oklch(0.72 0.2 300 / 0.15)",
  },
  {
    to: "/account" as const,
    icon: MoreHorizontal,
    label: "More",
    color: "oklch(0.73 0.19 25)",       // coral-red
    glow:  "oklch(0.73 0.19 25 / 0.5)",
    bg:    "oklch(0.73 0.19 25 / 0.15)",
  },
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
        try { return differenceInDays(parseISO(l.expiry_date), new Date()) <= 60; }
        catch { return false; }
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
    <nav
      aria-label="Main navigation"
      className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Liquid glass pill */}
      <div className="liquid-nav rounded-[32px] px-1.5 py-1.5">
        <LayoutGroup id="bottom-nav">
          <div className="flex items-center justify-around gap-0.5">
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
                  className="relative flex flex-col items-center gap-0.5 flex-1 py-1 rounded-[22px] transition-all duration-200 press"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {/* Active pill background */}
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                      className="absolute inset-0 rounded-[22px]"
                      style={{ background: item.bg }}
                    />
                  )}

                  {/* Icon */}
                  <span className="relative z-10">
                    <motion.span
                      animate={isActive ? { scale: 1.15 } : { scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className="block"
                    >
                      <item.icon
                        className="h-[22px] w-[22px] transition-all duration-200"
                        strokeWidth={isActive ? 2.3 : 1.8}
                        style={{
                          color: item.color,
                          opacity: isActive ? 1 : 0.55,
                          filter: isActive
                            ? `drop-shadow(0 0 8px ${item.glow})`
                            : "none",
                        }}
                      />
                    </motion.span>
                    {showBadge && (
                      <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-red-500 border-2 border-background" />
                    )}
                  </span>

                  {/* Label */}
                  <span
                    className="relative z-10 text-[9px] font-semibold tracking-wide transition-all duration-200"
                    style={{ color: item.color, opacity: isActive ? 1 : 0.55 }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </LayoutGroup>
      </div>
    </nav>
  );
}
