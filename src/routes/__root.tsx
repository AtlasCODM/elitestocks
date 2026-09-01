import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useLocation,
} from "@tanstack/react-router";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { MaintenancePage } from "./maintenance";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-gold gold-text-glow">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Elite Stocks — Institutional-Grade Digital Asset Trading" },
      {
        name: "description",
        content:
          "AI-powered institutional crypto intelligence, brokerage, and trading infrastructure with bank-grade security and elite-tier strategy modules.",
      },
      { name: "theme-color", content: "#0a0a0a" },
      { property: "og:title", content: "EliteStock — Institutional-Grade Digital Asset Trading" },
      {
        property: "og:description",
        content:
          "AI-powered institutional crypto intelligence, brokerage, and trading infrastructure with bank-grade security and elite-tier strategy modules.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Elite Stocks — Institutional-Grade Digital Asset Trading",
      },
      {
        name: "twitter:description",
        content:
          "AI-powered institutional crypto intelligence, brokerage, and trading infrastructure with bank-grade security and elite-tier strategy modules.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e0856500-e5b4-4d48-bfed-0d3a9347f4ef/id-preview-a52a005e--23c088e9-ed6e-44af-aa44-7e479a159e1c.lovable.app-1780110497546.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e0856500-e5b4-4d48-bfed-0d3a9347f4ef/id-preview-a52a005e--23c088e9-ed6e-44af-aa44-7e479a159e1c.lovable.app-1780110497546.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
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
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MaintenanceGate />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function MaintenanceGate() {
  const location = useLocation();
  const enabled = import.meta.env.VITE_MAINTENANCE_MODE === "true";
  if (enabled && location.pathname !== "/maintenance") return <MaintenancePage />;
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
