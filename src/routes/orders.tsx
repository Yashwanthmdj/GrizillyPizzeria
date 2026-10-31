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

function when(at: number) {
  return new Date(at).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

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
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-8 sm:px-6 sm:py-10">
        {mine.length === 0 && (
          <div className="rounded-3xl bg-card p-8 text-center shadow-warm sm:p-10">
            <p className="font-display text-2xl">No orders yet.</p>
            <p className="text-muted-foreground">Your first slice is waiting.</p>
            <Button asChild className="mt-4">
              <Link to="/menu">Order now</Link>
            </Button>
          </div>
        )}
        {mine.map((o, i) => (
          <Reveal key={o.id} delay={Math.min(i, 6) * 0.04}>
            <div className="rounded-3xl bg-card p-4 shadow-warm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Link
                  to="/order/$id"
                  params={{ id: o.id }}
                  className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4"
                >
                  <span className="shrink-0 font-display text-2xl text-primary">#{o.number}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate font-semibold">
                        {o.lines.map((l) => l.name).join(", ")}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                          o.status === "Ready"
                            ? "bg-success text-success-foreground"
                            : o.status === "Rejected"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted",
                        )}
                      >
                        {o.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {when(o.createdAt)} · {inr(o.total)}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 hidden size-5 shrink-0 text-muted-foreground sm:mt-0 sm:block" />
                </Link>
                <Button
                  variant="secondary"
                  className="w-full shrink-0 sm:w-auto"
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
