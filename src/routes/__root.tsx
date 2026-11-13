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
import { INTRO_MS, LoadingScreen } from "@/components/brand";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-5xl font-bold text-primary sm:text-7xl">404</h1>
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
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { name: "theme-color", content: "#AF2225" },
      { title: "Grizzly Pizzeria" },
      {
        name: "description",
        content:
          "100% vegetarian pizzeria in Madhapur, Hyderabad. Hand-stretched pizza for pickup — no meat, no egg.",
      },
      { property: "og:title", content: "Grizzly Pizzeria" },
      {
        property: "og:description",
        content: "A 100% vegetarian kitchen. Hand-stretched pizza for pickup from two Madhapur dens.",
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
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Unbounded:wght@500;600;700&display=swap",
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

const LOADER_MS = INTRO_MS;
let hideLoader = () => {};
let loaderStart = 0;

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // The 5.5s clock starts when this screen mounts, not when the script is parsed.
  // On a phone the script can take longer than the intro, which used to dismiss
  // the screen before it painted. The start time is module-scoped so a strict-mode
  // remount keeps the same deadline and schedules a fresh timeout.
  const [ready, setReady] = useState(false);
  const [fading, setFading] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  useEffect(() => {
    setReady(true);
    hideLoader = () => setFading(true);
    if (!loaderStart) loaderStart = Date.now();
    const remaining = Math.max(0, LOADER_MS - (Date.now() - loaderStart));
    const t = window.setTimeout(() => hideLoader(), remaining);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!fading) return;
    const t = window.setTimeout(() => setShowLoader(false), 450);
    return () => window.clearTimeout(t);
  }, [fading]);

  return (
    <QueryClientProvider client={queryClient}>
      {ready && <Outlet />}
      {showLoader && <LoadingScreen intro fading={fading} />}
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
