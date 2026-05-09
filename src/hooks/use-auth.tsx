/**
 * useAuth — global auth state hook.
 *
 * Uses onAuthStateChange INITIAL_SESSION (Supabase v2 recommended).
 * getSession() and a 5-second timeout act as fallbacks so the spinner
 * never hangs forever regardless of network conditions.
 */
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let resolved = false;

    const resolve = (s: Session | null) => {
      if (resolved) return;
      resolved = true;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    };

    // Primary: INITIAL_SESSION fires in Supabase v2 without a network round-trip.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "INITIAL_SESSION") {
        resolve(s);
      } else {
        setSession(s);
        setUser(s?.user ?? null);
      }
    });

    // Fallback 1: getSession() in case INITIAL_SESSION is delayed.
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => resolve(s))
      .catch(() => resolve(null));

    // Fallback 2: hard 5-second timeout so the spinner never hangs forever.
    const timeout = setTimeout(() => resolve(null), 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return { user, session, loading };
}
