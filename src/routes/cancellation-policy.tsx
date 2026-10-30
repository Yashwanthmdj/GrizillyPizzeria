import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/shop/LegalLayout";
import { seo } from "@/components/shop/ShopLayout";
import { useDB } from "@/services/store";

export const Route = createFileRoute("/cancellation-policy")({
  head: () =>
    seo(
      "Cancellations · Grizzly Pizzeria",
      "Placeholder cancellation policy for Grizzly Pizzeria.",
      "/cancellation-policy",
    ),
  component: CancelPage,
});

function CancelPage() {
  const text = useDB().settings.cancellationText;
  return (
    <LegalLayout title="Cancellations">
      <p>Placeholder text, to be replaced by the approved policy.</p>
      <p>{text}</p>
    </LegalLayout>
  );
}
