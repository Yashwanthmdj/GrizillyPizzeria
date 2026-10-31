import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE } from "@/components/brand";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { CartDrawer } from "./CartDrawer";
import { ItemSheet } from "./ItemSheet";
import { ShopUIProvider } from "./ui-context";

export function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <ShopUIProvider>
      <div className="flex min-h-dvh w-full min-w-0 flex-col overflow-x-clip">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <Header />
        <motion.main
          id="main"
          className="min-w-0 flex-1"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          {children}
        </motion.main>
        <Footer />
        <CartDrawer />
        <ItemSheet />
      </div>
    </ShopUIProvider>
  );
}

export function PageHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow?: string | undefined;
  title: string;
  sub?: string | undefined;
}) {
  return (
    <div className="bg-hero grain text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pb-14 sm:pt-14">
        {eyebrow && (
          <p className="text-sm font-bold uppercase tracking-widest text-secondary">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-3xl font-bold sm:text-5xl md:text-6xl">{title}</h1>
        {sub && <p className="mt-2 max-w-xl text-primary-foreground/80">{sub}</p>}
      </div>
    </div>
  );
}

export function seo(title: string, description: string, path = "/") {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [{ rel: "canonical", href: path }],
  };
}
