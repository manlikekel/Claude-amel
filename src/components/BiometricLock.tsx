import { useEffect, useRef, useState } from "react";
import { Fingerprint, Lock, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { isBiometricEnabled, verifyBiometric } from "@/lib/biometric";

const RELOCK_DELAY_MS = 5 * 60 * 1000; // 5 minutes

export function BiometricLock({ children }: { children: React.ReactNode }) {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const relockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (session && isBiometricEnabled()) {
        setLocked(true);
      }
      setHasSession(!!session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      if (!session) setLocked(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Re-lock after 5 minutes in the background
  useEffect(() => {
    if (!hasSession || typeof localStorage === "undefined" || !isBiometricEnabled()) return;

    const scheduleRelock = () => {
      if (relockTimer.current) clearTimeout(relockTimer.current);
      relockTimer.current = setTimeout(() => setLocked(true), RELOCK_DELAY_MS);
    };

    const cancelRelock = () => {
      if (relockTimer.current) { clearTimeout(relockTimer.current); relockTimer.current = null; }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        scheduleRelock();
      } else {
        cancelRelock();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      cancelRelock();
    };
  }, [hasSession]);

  const handleUnlock = async () => {
    setError("");
    setVerifying(true);
    try {
      const ok = await verifyBiometric();
      if (ok) {
        setLocked(false);
      } else {
        setError("Biometric check failed — try again or use your password.");
      }
    } catch {
      setError("Biometric check failed — try again or use your password.");
    } finally {
      setVerifying(false);
    }
  };

  const handleUsePassword = async () => {
    await supabase.auth.signOut();
    setLocked(false);
  };

  if (!locked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background px-5">
      <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-72 w-96 rounded-full bg-primary/8 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-wine/40 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xs text-center"
      >
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl glass gold-glow-sm border border-primary/20 mb-6">
          <Lock className="h-8 w-8 text-primary" />
        </div>

        <h1 className="font-display text-[40px] font-extrabold tracking-tight leading-none mb-1">
          AM<span className="gold-text">EL</span>
        </h1>
        <p className="text-sm text-muted-foreground mb-8">Your session is locked</p>

        <div className="flex flex-col gap-3">
          <Button
            variant="hero"
            size="lg"
            onClick={handleUnlock}
            disabled={verifying}
            className="gap-2"
          >
            <Fingerprint className="h-4 w-4" />
            {verifying ? "Verifying…" : "Unlock with Biometrics"}
          </Button>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive text-left"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </motion.div>
          )}

          <Button variant="ghost" size="sm" onClick={handleUsePassword} className="text-muted-foreground">
            Use password instead
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
