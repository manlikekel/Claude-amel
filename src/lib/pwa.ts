/**
 * PWA helpers — service worker registration + install prompt management.
 *
 * Registration is gated to avoid interfering with Lovable preview iframes.
 */

const DISMISS_KEY = "amel.pwa.dismissed_at";
const DISMISS_DAYS = 7;

export function isInIframe(): boolean {
  try { return window.self !== window.top; } catch { return true; }
}

export function isPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com") || h === "localhost" || h === "127.0.0.1";
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

export function dismissInstallPrompt(): void {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
}

export function isInstallPromptSilenced(): boolean {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (!t) return false;
    return Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

/** Register the SW only on production-like hosts and outside iframes. */
export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // In the Lovable editor preview, unregister any existing SW and bail.
  if (isPreviewHost() || isInIframe()) {
    const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
    return;
  }

  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (err) {
    console.warn("[pwa] SW registration failed", err);
  }
}

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
