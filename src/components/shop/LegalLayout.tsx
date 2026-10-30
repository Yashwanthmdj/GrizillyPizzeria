import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageHead, ShopLayout } from "@/components/shop/ShopLayout";

const LINKS = [
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "/refund-policy", label: "Refunds" },
  { to: "/cancellation-policy", label: "Cancellations" },
] as const;

export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ShopLayout>
      <PageHead
        eyebrow="Legal"
        title={title}
        sub="Placeholder text, to be replaced by the approved policy."
      />
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[180px_1fr]">
        <nav aria-label="Policies" className="flex flex-wrap gap-2 md:flex-col">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-muted"
              activeProps={{ className: "bg-primary text-primary-foreground" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <article className="rounded-3xl bg-card p-6 shadow-warm sm:p-8">
          <p className="mb-4 rounded-2xl bg-warning/30 px-4 py-3 text-sm font-semibold text-cocoa">
            Placeholder text, to be replaced by the approved policy.
          </p>
          <div className="space-y-4 text-sm leading-relaxed text-foreground/90">{children}</div>
        </article>
      </div>
    </ShopLayout>
  );
}
