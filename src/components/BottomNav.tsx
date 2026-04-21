import { Link, useLocation } from "@tanstack/react-router";
import { Home, Search, Target, BarChart3, User } from "lucide-react";

const navItems = [
  { to: "/" as const, icon: Home, label: "Logbook" },
  { to: "/search" as const, icon: Search, label: "Search" },
  { to: "/readiness" as const, icon: Target, label: "Readiness" },
  { to: "/experience" as const, icon: BarChart3, label: "Stats" },
  { to: "/account" as const, icon: User, label: "Account" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md safe-area-pb">
      <div className="glass-nav rounded-3xl px-2 py-2">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const isActive =
              item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-3 py-2 text-[10px] transition-all ${
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {isActive && (
                  <span className="absolute inset-0 rounded-2xl gold-gradient gold-glow-sm" />
                )}
                <item.icon
                  className={`h-5 w-5 relative ${
                    isActive ? "drop-shadow-[0_0_4px_oklch(0_0_0/0.3)]" : ""
                  }`}
                />
                <span className="font-medium relative">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
