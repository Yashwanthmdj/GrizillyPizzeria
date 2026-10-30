import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/shop/LegalLayout";
import { seo } from "@/components/shop/ShopLayout";
import { useDB } from "@/services/store";

export const Route = createFileRoute("/refund-policy")({
  head: () =>
    seo(
      "Refunds · Grizzly Pizzeria",
      "Placeholder refund policy for Grizzly Pizzeria.",
      "/refund-policy",
    ),
  component: RefundPage,
});

function RefundPage() {
  const text = useDB().settings.refundText;
  return (
    <LegalLayout title="Refunds">
      <p>Placeholder text, to be replaced by the approved policy.</p>
      <p>{text}</p>
    </LegalLayout>
  );
}
