import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { fetchLicences } from "@/lib/data";
import { summariseLicences, expiryPromptMessage } from "@/lib/licence-status";

const SESSION_KEY = "amel.licence_toast_shown";

/**
 * On app open (once per session, signed-in users only), checks all licences
 * and surfaces a single toast if anything is approaching expiry.
 */
export function LicenceExpiryToast() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch { /* ignore */ }

    let cancelled = false;
    (async () => {
      try {
        const licences = await fetchLicences();
        if (cancelled) return;
        const summary = summariseLicences(licences);
        const prompt = expiryPromptMessage(summary);
        if (!prompt) return;

        try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }

        if (prompt.level === "urgent") {
          toast.error(prompt.title, {
            description: prompt.description,
            duration: 8000,
            action: {
              label: "View",
              onClick: () => { window.location.href = "/account"; },
            },
          });
        } else {
          toast.warning(prompt.title, {
            description: prompt.description,
            duration: 7000,
            action: {
              label: "View",
              onClick: () => { window.location.href = "/account"; },
            },
          });
        }
      } catch (e) { console.error("licence-toast", e); }
    })();
    return () => { cancelled = true; };
  }, [user, loading]);

  return null;
}
