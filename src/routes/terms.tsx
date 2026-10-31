import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/shop/LegalLayout";
import { seo } from "@/components/shop/ShopLayout";

export const Route = createFileRoute("/terms")({
  head: () => seo("Terms · Grizzly Pizzeria", "Placeholder terms for Grizzly Pizzeria.", "/terms"),
  component: () => (
    <LegalLayout title="Terms">
      <p>
        Orders are for pickup from the Madhapur outlet you choose. Wait times are estimates based on
        who is clocked in and what is already in the ovens. Individual items can be collected as
        they are ready.
      </p>
      <p>Menu prices, wait times and loyalty rules can change from the owner dashboard.</p>
    </LegalLayout>
  ),
});
