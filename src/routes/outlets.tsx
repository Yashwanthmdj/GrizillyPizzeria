import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHead, ShopLayout, seo } from "@/components/shop/ShopLayout";
import { OutletCard } from "@/components/shop/OutletCard";
import { Reveal } from "@/components/brand";
import { useDB, useSession } from "@/services/store";
import { selectOutlet } from "@/services/api";

export const Route = createFileRoute("/outlets")({
  head: () =>
    seo(
      "Choose your outlet · Grizzly Pizzeria",
      "Pick a Grizzly Pizzeria outlet, check live wait times and opening hours.",
    ),
  component: Outlets,
});

function Outlets() {
  const db = useDB();
  const s = useSession();
  const nav = useNavigate();
  return (
    <ShopLayout>
      <PageHead
        eyebrow="Step 1"
        title="Pick your den"
        sub="Live wait times, straight from the kitchen."
      />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-2">
        {db.outlets.map((o, i) => (
          <Reveal key={o.id} delay={i * 0.1}>
            <OutletCard
              outlet={o}
              orders={db.orders}
              selected={s.outletId === o.id}
              onSelect={() => {
                selectOutlet(o.id);
                toast.success(`Ordering from ${o.short}`);
                nav({ to: "/menu" });
              }}
            />
          </Reveal>
        ))}
      </div>
    </ShopLayout>
  );
}
