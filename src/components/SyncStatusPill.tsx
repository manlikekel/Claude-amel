/**
 * Small floating status indicator: Online / Offline Mode / Pending Sync.
 * Subtle and non-blocking.
 */
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function SyncStatusPill() {
  const { online, pending, syncing } = useOnlineStatus();
  // Only render if there's something to say
  const show = !online || pending > 0 || syncing;
  let label = "Online";
  let Icon = Cloud;
  let cls = "text-success bg-status-green border-success/30";
  if (!online) {
    label = "Offline Mode";
    Icon = CloudOff;
    cls = "text-warning bg-status-amber border-warning/30";
  } else if (syncing) {
    label = "Syncing…";
    Icon = RefreshCw;
    cls = "text-primary bg-primary/10 border-primary/30";
  } else if (pending > 0) {
    label = `${pending} Pending Sync`;
    Icon = RefreshCw;
    cls = "text-warning bg-status-amber border-warning/30";
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed top-3 right-3 z-50 pointer-events-none safe-area-pt"
        >
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md ${cls}`}>
            <Icon className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            {label}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
