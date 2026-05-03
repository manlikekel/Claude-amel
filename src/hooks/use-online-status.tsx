import { useEffect, useState } from "react";
import { subscribeSyncStatus } from "@/lib/sync";

export interface OnlineStatus {
  online: boolean;
  pending: number;
  syncing: boolean;
}

export function useOnlineStatus(): OnlineStatus {
  const [s, setS] = useState<OnlineStatus>({
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    pending: 0,
    syncing: false,
  });
  useEffect(() => subscribeSyncStatus(setS), []);
  return s;
}
