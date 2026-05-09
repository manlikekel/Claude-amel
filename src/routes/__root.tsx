import { useEffect } from "react";
import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { SideNav } from "@/components/SideNav";
import { AuthGate } from "@/components/AuthGate";
import { OnboardingTour } from "@/components/OnboardingTour";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/hooks/use-theme";
import { TabAccentSync } from "@/hooks/use-tab-accent";
import { LicenceExpiryToast } from "@/components/LicenceExpiryToast";
import { InstallPrompt } from "@/components/InstallPrompt";
import { SyncStatusPill } from "@/components/SyncStatusPill";
import { BiometricLock } from "@/components/BiometricLock";
import { registerServiceWorker } from "@/lib/pwa";
import { installSyncListeners } from "@/lib/sync";
import { getLocale, isRtl } from "@/lib/i18n";
import { toast } from "sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AMEL" },
      { name: "description", content: "Log, track, and search aircraft maintenance faults intelligently." },
      { name: "author", content: "AMEL" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "AMEL" },
      { property: "og:description", content: "Log, track, and search aircraft maintenance faults intelligently." },
      { name: "twitter:title", content: "AMEL" },
      { name: "twitter:description", content: "Log, track, and search aircraft maintenance faults intelligently." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/2523d822-84db-4de0-b01b-3ec233cf83fd" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/2523d822-84db-4de0-b01b-3ec233cf83fd" },
      { name: "theme-color", content: "#0a0606" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "AMEL" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    registerServiceWorker();
    installSyncListeners();
    // Apply persisted locale on every mount so direction & lang reflect user choice.
    const loc = getLocale();
    if (typeof document !== "undefined") {
      document.documentElement.lang = loc;
      document.documentElement.dir = isRtl(loc) ? "rtl" : "ltr";
    }
  }, []);

  useEffect(() => {
    if (!navigator.onLine) {
      toast.error("You're offline — changes will sync when reconnected");
    }
    const handleOffline = () => toast.error("You're offline — changes will sync when reconnected");
    const handleOnline = () => toast.success("Back online");
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);
  return (
    <ThemeProvider>
      <TabAccentSync />
      <BiometricLock>
        <AuthGate>
          <SideNav />
          <main className="lg:pl-64 min-h-screen">
            <Outlet />
          </main>
          <BottomNav />
          <OnboardingTour />
          <LicenceExpiryToast />
          <InstallPrompt />
          <SyncStatusPill />
        </AuthGate>
      </BiometricLock>
      <Toaster
        position="top-center"
        offset={20}
        richColors
        closeButton
        toastOptions={{ duration: 4000 }}
      />
    </ThemeProvider>
  );
}
