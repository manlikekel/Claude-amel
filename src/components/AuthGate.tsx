import { useAuth } from "@/hooks/use-auth";
import { AuthScreen } from "@/components/AuthScreen";
import { Plane } from "lucide-react";
import { useLocation } from "@tanstack/react-router";

/** Routes that must render even when not signed in. */
const PUBLIC_PATHS = ["/reset-password"];

/**
 * AuthGate — wraps the app and shows an inline auth screen
 * when the user is not signed in. Public paths (e.g. password reset)
 * always render so deep links from emails work.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isPublic = PUBLIC_PATHS.some((p) => location.pathname.startsWith(p));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Plane className="h-10 w-10 animate-pulse text-primary" />
      </div>
    );
  }

  if (!user && !isPublic) return <AuthScreen />;

  return <div id="amel-app-root">{children}</div>;
}
