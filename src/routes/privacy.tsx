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
      <p>Placeholder text, to be replaced by the approved policy.</p>
      <p>
        This demo stores your name, phone, cart and orders in the browser on this device. Nothing is
        sent to a payment network or a messaging provider.
      </p>
      <p>
        When a real backend is connected, this page will describe what is collected, why, and how
        long it is kept.
      </p>
    </LegalLayout>
  ),
});
