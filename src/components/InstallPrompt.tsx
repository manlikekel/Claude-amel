/**
 * InstallPrompt — shown on the AuthScreen (login) and dismissible for 7 days.
 * Hidden when already installed, on unsupported browsers, or recently dismissed.
 */
import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isStandalone, isMobile, isIOS, isInstallPromptSilenced,
  dismissInstallPrompt, isPreviewHost, isInIframe,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa";
import { motion, AnimatePresence } from "framer-motion";

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isMobile() || isInstallPromptSilenced()) return;
    if (isPreviewHost() || isInIframe()) return;

    if (isIOS()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler as any);
    return () => window.removeEventListener("beforeinstallprompt", handler as any);
  }, []);

  const install = async () => {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    if (choice.outcome !== "accepted") dismissInstallPrompt();
    setVisible(false);
    setEvent(null);
  };

  const dismiss = () => {
    dismissInstallPrompt();
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-sm"
        >
          <div className="glass rounded-2xl p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gold-gradient gold-glow-sm">
                <Download className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Install AMEL on your phone</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {iosHint
                    ? "Tap Share → Add to Home Screen"
                    : "Get faster access and use AMEL like an app."}
                </p>
                <div className="mt-3 flex gap-2">
                  {iosHint ? (
                    <Button size="sm" variant="action" className="flex-1 gap-1.5" onClick={dismiss}>
                      <Share className="h-3.5 w-3.5" /> Got it
                    </Button>
                  ) : (
                    <Button size="sm" variant="hero" className="flex-1" onClick={install}>
                      Install App
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={dismiss}>
                    Maybe Later
                  </Button>
                </div>
              </div>
              <button
                aria-label="Dismiss install prompt"
                onClick={dismiss}
                className="text-muted-foreground hover:text-foreground p-1 -m-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
