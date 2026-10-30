import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/shop/LegalLayout";
import { seo } from "@/components/shop/ShopLayout";

export const Route = createFileRoute("/terms")({
  head: () => seo("Terms · Grizzly Pizzeria", "Placeholder terms for Grizzly Pizzeria.", "/terms"),
  component: () => (
    <LegalLayout title="Terms">
      <p>Placeholder text, to be replaced by the approved policy.</p>
      <p>
        Orders are for pickup from the Madhapur outlet you choose. Online payment in this demo does
        not charge a card.
      </p>
      <p>Menu prices, wait times and loyalty rules can change from the owner dashboard.</p>
    </LegalLayout>
  ),
});
