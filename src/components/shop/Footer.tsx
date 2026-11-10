import { Link } from "@tanstack/react-router";
import { Instagram, MessageCircle } from "lucide-react";
import { Logo } from "@/components/brand";
import { DeliveryLinks } from "@/components/shop/DeliveryLinks";
import { useDB } from "@/services/store";

const EAT = [
  { to: "/menu", label: "Menu" },
  { to: "/outlets", label: "Outlets" },
  { to: "/rewards", label: "Rewards" },
  { to: "/orders", label: "My orders" },
  { to: "/contact", label: "Contact" },
  { to: "/account", label: "Account" },
] as const;

const TEAM = [
  { to: "/kitchen/login", label: "Kitchen login" },
  { to: "/admin/login", label: "Owner login" },
] as const;

const LEGAL = [
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "/refund-policy", label: "Refunds" },
  { to: "/cancellation-policy", label: "Cancellations" },
] as const;

const linkCls = "block py-1.5 text-sm text-primary-foreground/85 hover:text-secondary";

export function Footer() {
  const db = useDB();
  return (
    <footer className="bg-primary-deep text-primary-foreground grain">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid grid-cols-1 gap-8 min-[480px]:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="min-[480px]:col-span-2 lg:col-span-1">
            <Logo className="h-9 sm:h-11" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-primary-foreground/75">
              A 100% vegetarian kitchen in Madhapur. Big slices, bigger bite — no meat, no egg, no
              compromise.
            </p>
            <div className="mt-4 flex gap-2">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="grid size-10 place-items-center rounded-full bg-primary transition hover:bg-secondary hover:text-primary-deep"
              >
                <Instagram className="size-5" />
              </a>
              <a
                href={`https://wa.me/91${db.settings.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="grid size-10 place-items-center rounded-full bg-primary transition hover:bg-secondary hover:text-primary-deep"
              >
                <MessageCircle className="size-5" />
              </a>
            </div>
            <DeliveryLinks className="mt-4" tone="dark" />
          </div>
          <div>
            <h3 className="font-display text-base text-secondary sm:text-lg">Eat</h3>
            <ul className="mt-2">
              {EAT.map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className={linkCls}>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-display text-base text-secondary sm:text-lg">Team</h3>
            <ul className="mt-2">
              {TEAM.map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className={linkCls}>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-1 border-t border-primary-foreground/10 pt-5 text-sm text-primary-foreground/70">
          {LEGAL.map((n) => (
            <Link key={n.to} to={n.to} className="py-1 hover:text-secondary">
              {n.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 px-4 py-4 text-center text-xs text-primary-foreground/60">
        © {new Date().getFullYear()} Grizzly Pizzeria · Madhapur, Hyderabad
      </div>
    </footer>
  );
}
