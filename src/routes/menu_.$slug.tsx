import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Img, Skeleton } from "@/components/brand";
import { ItemCustomizer } from "@/components/shop/ItemCustomizer";
import { MenuCard } from "@/components/shop/MenuCard";
import { PageHead, ShopLayout, seo } from "@/components/shop/ShopLayout";
import { addToCart, loadProduct } from "@/services/api";
import { useDB, useSession } from "@/services/store";
import type { MenuItem } from "@/services/types";

export const Route = createFileRoute("/menu_/$slug")({
  head: ({ params }) =>
    seo(
      `Menu · Grizzly Pizzeria`,
      "Customize a Grizzly Pizzeria item and add it to your box.",
      `/menu/${params.slug}`,
    ),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const db = useDB();
  const s = useSession();
  const [item, setItem] = useState<MenuItem | null>(null);
  const [status, setStatus] = useState<"loading" | "empty" | "error" | "ready">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let live = true;
    setStatus("loading");
    loadProduct(slug)
      .then((found) => {
        if (!live) return;
        setItem(found);
        setStatus(found ? "ready" : "empty");
      })
      .catch((error: Error) => {
        if (!live) return;
        setMessage(error.message);
        setStatus("error");
      });
    return () => {
      live = false;
    };
  }, [slug]);

  const live = item ? (db.menu.find((m) => m.id === item.id) ?? item) : null;
  const related = live
    ? db.menu.filter((m) => m.category === live.category && m.id !== live.id).slice(0, 4)
    : [];

  return (
    <ShopLayout>
      <PageHead eyebrow="Menu" title={live?.name ?? "Menu item"} sub={live?.description} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {status === "loading" && <Skeleton className="h-80" />}
        {status === "error" && (
          <div className="rounded-3xl bg-card p-10 text-center shadow-warm" role="alert">
            <p className="font-display text-3xl">This item didn't load</p>
            <p className="mt-2 text-muted-foreground">{message}</p>
            <Button asChild className="mt-4">
              <Link to="/menu">Back to the menu</Link>
            </Button>
          </div>
        )}
        {status === "empty" && (
          <div className="rounded-3xl bg-card p-10 text-center shadow-warm">
            <p className="font-display text-3xl">That item isn't on the menu.</p>
            <Button asChild className="mt-4">
              <Link to="/menu">See everything</Link>
            </Button>
          </div>
        )}
        {status === "ready" && live && (
          <div className="grid gap-6 md:grid-cols-2">
            <Img
              src={live.image}
              alt={live.name}
              className="aspect-[4/3] w-full rounded-3xl bg-white p-3 sm:aspect-square sm:p-6"
            />
            <div>
              <p className="text-sm font-semibold text-muted-foreground">
                {live.category} · 100% vegetarian
              </p>
              <ItemCustomizer
                item={live}
                outletId={s.outletId}
                onAdd={(line) => {
                  addToCart(line);
                  toast.success(`${live.name} is in the box`);
                }}
              />
              <Link to="/menu" className="mt-4 inline-block text-sm font-semibold text-primary">
                All items
              </Link>
            </div>
          </div>
        )}
        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-3xl">You might also like</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((m, i) => (
                <MenuCard key={m.id} item={m} outletId={s.outletId} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>
    </ShopLayout>
  );
}
