import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

/**
 * Sets `data-tab="..."` on <html> based on the current route, so per-tab
 * accent CSS variables (`.light[data-tab="home"]` etc.) take effect.
 * Mounted once at the root.
 */
export function TabAccentSync() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    let tab = "home";
    if (path.startsWith("/search")) tab = "search";
    else if (path.startsWith("/experience")) tab = "experience";
    else if (path.startsWith("/account")) tab = "more";
    else if (path.startsWith("/readiness")) tab = "readiness";
    else if (path.startsWith("/log")) tab = "log";
    else if (path.startsWith("/logs")) tab = "logs";
    document.documentElement.setAttribute("data-tab", tab);
  }, [location.pathname]);
  return null;
}
