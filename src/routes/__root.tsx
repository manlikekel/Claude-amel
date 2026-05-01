import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { AuthGate } from "@/components/AuthGate";
import { OnboardingTour } from "@/components/OnboardingTour";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/hooks/use-theme";
import { TabAccentSync } from "@/hooks/use-tab-accent";
import { LicenceExpiryToast } from "@/components/LicenceExpiryToast";

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
    ],
    links: [{ rel: "stylesheet", href: appCss }],
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
  return (
    <AuthGate>
      <Outlet />
      <BottomNav />
      <OnboardingTour />
      <Toaster position="top-center" />
    </AuthGate>
  );
}
