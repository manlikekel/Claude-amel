import { Link, useLocation } from "@tanstack/react-router";
import { Home, PlusCircle, Search, BarChart3 } from "lucide-react";

const navItems = [
  { to: "/" as const, icon: Home, label: "Home" },
  { to: "/log" as const, icon: PlusCircle, label: "Log" },
  { to: "/search" as const, icon: Search, label: "Search" },
  { to: "/experience" as const, icon: BarChart3, label: "Stats" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav safe-area-pb">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 text-xs transition-all ${
                isActive ? "text-primary scale-105" : "text-muted-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "drop-shadow-[0_0_6px_oklch(0.78_0.12_80/0.5)]" : ""}`} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
