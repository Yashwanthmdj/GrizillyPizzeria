import { Link } from "@tanstack/react-router";
import { Instagram, MessageCircle } from "lucide-react";
import { Logo } from "@/components/brand";
import { useDB } from "@/services/store";

export function Footer() {
  const db = useDB();
  return (
    <footer className="bg-primary-deep text-primary-foreground grain">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo className="h-12" />
          <p className="mt-4 max-w-xs text-sm text-primary-foreground/75">
            Big slices, bigger bite. Hand-stretched in Hyderabad since forever (ok, recently).
          </p>
          <div className="mt-5 flex gap-2">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="grid size-11 place-items-center rounded-full bg-primary transition hover:bg-secondary hover:text-primary-deep"
            >
              <Instagram className="size-5" />
            </a>
            <a
              href={`https://wa.me/91${db.settings.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp demo"
              className="grid size-11 place-items-center rounded-full bg-primary transition hover:bg-secondary hover:text-primary-deep"
            >
              <MessageCircle className="size-5" />
            </a>
          </div>
        </div>
        <div>
          <h3 className="font-display text-lg text-secondary">Eat</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/menu" className="hover:text-secondary">
                Menu
              </Link>
            </li>
            <li>
              <Link to="/outlets" className="hover:text-secondary">
                Outlets
              </Link>
            </li>
            <li>
              <Link to="/rewards" className="hover:text-secondary">
                Rewards
              </Link>
            </li>
            <li>
              <Link to="/orders" className="inline-flex min-h-11 items-center hover:text-secondary">
                My orders
              </Link>
            </li>
            <li>
              <Link
                to="/contact"
                className="inline-flex min-h-11 items-center hover:text-secondary"
              >
                Contact
              </Link>
            </li>
            <li>
              <Link
                to="/account"
                className="inline-flex min-h-11 items-center hover:text-secondary"
              >
                Account
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-lg text-secondary">Team</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                to="/kitchen/login"
                className="inline-flex min-h-11 items-center hover:text-secondary"
              >
                Kitchen login
              </Link>
            </li>
            <li>
              <Link
                to="/admin/login"
                className="inline-flex min-h-11 items-center hover:text-secondary"
              >
                Owner login
              </Link>
            </li>
            <li>
              <Link
                to="/privacy"
                className="inline-flex min-h-11 items-center hover:text-secondary"
              >
                Privacy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="inline-flex min-h-11 items-center hover:text-secondary">
                Terms
              </Link>
            </li>
            <li>
              <Link
                to="/refund-policy"
                className="inline-flex min-h-11 items-center hover:text-secondary"
              >
                Refunds
              </Link>
            </li>
            <li>
              <Link
                to="/cancellation-policy"
                className="inline-flex min-h-11 items-center hover:text-secondary"
              >
                Cancellations
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 py-5 text-center text-xs text-primary-foreground/60">
        © {new Date().getFullYear()} Grizzly Pizzeria · Demo build: payments and WhatsApp are
        simulated.
      </div>
    </footer>
  );
}
