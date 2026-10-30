import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportError } from "../lib/report-error";
import { LoadingScreen } from "@/components/brand";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">This slice went missing</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-deep"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportError(error, { boundary: "root" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-deep"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#AF2225" },
      { title: "Grizzly Pizzeria" },
      {
        name: "description",
        content: "Order big slices from Grizzly Pizzeria for pickup in Madhapur, Hyderabad.",
      },
      { property: "og:title", content: "Grizzly Pizzeria" },
      {
        property: "og:description",
        content: "Hand-stretched pizza for pickup from two Madhapur outlets.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "canonical", href: "/" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Fredoka:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
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

const LOADER_MS = 1100;
let hideLoader = () => {};
let loaderStarted = 0;

if (typeof window !== "undefined" && !loaderStarted) {
  loaderStarted = Date.now();
  window.setTimeout(() => hideLoader(), LOADER_MS);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Data lives in browser storage (demo layer), so the app renders after hydration
  // behind the branded loading screen. The timer is module-scoped and is never
  // cleared, so a strict-mode remount cannot cancel the only way to dismiss it.
  const [ready, setReady] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  useEffect(() => {
    setReady(true);
    hideLoader = () => setShowLoader(false);
    if (loaderStarted && Date.now() - loaderStarted >= LOADER_MS) hideLoader();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {ready && <Outlet />}
      {showLoader && <LoadingScreen />}
      <Toaster
        position="top-center"
        toastOptions={{
          classNames: {
            toast: "!rounded-2xl !border-0 !bg-cocoa !text-cream !shadow-lift !font-sans",
            description: "!text-cream/70",
          },
        }}
      />
    </QueryClientProvider>
  );
}
