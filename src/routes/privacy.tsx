import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/shop/LegalLayout";
import { seo } from "@/components/shop/ShopLayout";

export const Route = createFileRoute("/privacy")({
  head: () =>
    seo(
      "Privacy · Grizzly Pizzeria",
      "Placeholder privacy policy for Grizzly Pizzeria.",
      "/privacy",
    ),
  component: () => (
    <LegalLayout title="Privacy">
      <p>
        We keep the account you create (name, phone, hashed password), your orders, and messages you
        send us on our servers so kitchens can cook and you can track pickup.
      </p>
      <p>
        Staff logins use encrypted sessions. Passwords are stored as one-way hashes, never as plain
        text. Cart contents stay on your device until you place an order.
      </p>
      <p>
        We do not sell your data. Write to hello@grizzlypizzeria.com to ask what we hold on your
        account.
      </p>
    </LegalLayout>
  ),
});
