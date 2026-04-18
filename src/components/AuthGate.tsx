import { useAuth } from "@/hooks/use-auth";
import { AuthScreen } from "@/components/AuthScreen";
import { Plane } from "lucide-react";

/**
 * AuthGate — wraps the app and shows an inline auth screen
 * when the user is not signed in. Keeps the URL stable so deep
 * links work after login.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Plane className="h-10 w-10 animate-pulse text-primary" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return <>{children}</>;
}
