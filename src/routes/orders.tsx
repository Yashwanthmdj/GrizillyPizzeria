import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/brand";
import { PageHead, ShopLayout, seo } from "@/components/shop/ShopLayout";
import { useDB, useSession } from "@/services/store";
import { reorder, signOutCustomer } from "@/services/api";
import { inr } from "@/services/pricing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders")({
  head: () => seo("My orders · Grizzly Pizzeria", "Your past and live Grizzly Pizzeria orders."),
  component: Orders,
});

function Orders() {
  const db = useDB();
  const s = useSession();
  const mine = db.orders.filter(
    (o) => s.myOrders.includes(o.id) || (s.phone && o.phone === s.phone),
  );
  return (
    <ShopLayout>
      <PageHead
        title="My orders"
        sub={s.phone ? `Signed in as ${s.phone}` : "Orders placed on this device"}
      />
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-10 sm:px-6">
        {mine.length === 0 && (
          <div className="rounded-3xl bg-card p-10 text-center shadow-warm">
            <p className="font-display text-2xl">No orders yet.</p>
            <p className="text-muted-foreground">Your first slice is waiting.</p>
            <Button asChild className="mt-4">
              <Link to="/menu">Order now</Link>
            </Button>
          </div>
        )}
        {mine.map((o, i) => (
          <Reveal key={o.id} delay={Math.min(i, 6) * 0.04}>
            <div className="flex items-center gap-4 rounded-3xl bg-card p-5 shadow-warm">
              <Link
                to="/order/$id"
                params={{ id: o.id }}
                className="flex min-w-0 flex-1 items-center gap-4"
              >
                <span className="font-display text-2xl text-primary">#{o.number}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{o.lines.map((l) => l.name).join(", ")}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {inr(o.total)}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold",
                    o.status === "Ready"
                      ? "bg-success text-success-foreground"
                      : o.status === "Rejected"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted",
                  )}
                >
                  {o.status}
                </span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </Link>
              <Button
                variant="secondary"
                onClick={async () => {
                  const result = await reorder(o.id);
                  if (result.skipped.length)
                    toast(`Skipped unavailable: ${result.skipped.join(", ")}`);
                  if (result.added)
                    toast.success(
                      `${result.added} item${result.added === 1 ? "" : "s"} back in the box`,
                    );
                  else toast.error("Nothing from that order is available right now.");
                }}
              >
                Reorder
              </Button>
            </div>
          </Reveal>
        ))}
        {s.phone && (
          <button
            onClick={signOutCustomer}
            className="mx-auto block pt-4 text-sm text-muted-foreground underline"
          >
            Sign out
          </button>
        )}
      </div>
    </ShopLayout>
  );
}
