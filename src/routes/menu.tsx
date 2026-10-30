import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutGroup, motion } from "framer-motion";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ShopLayout, seo } from "@/components/shop/ShopLayout";
import { MenuCard } from "@/components/shop/MenuCard";
import { VegDot } from "@/components/brand";
import { useDB, useSession } from "@/services/store";
import { itemPrice } from "@/services/pricing";
import { CATEGORIES, type Category } from "@/services/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/menu")({
  head: () =>
    seo(
      "Menu · Grizzly Pizzeria",
      "Pizzas, sides, drinks, desserts and combos. Veg and non-veg, made fresh at Grizzly Pizzeria.",
    ),
  component: MenuPage,
});

type Diet = "all" | "veg" | "nonveg";
type Sort = "popular" | "low" | "high";

function MenuPage() {
  const db = useDB();
  const s = useSession();
  const [cat, setCat] = useState<Category | "All">("All");
  const [diet, setDiet] = useState<Diet>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("popular");
  const outlet = db.outlets.find((o) => o.id === s.outletId);

  const items = useMemo(() => {
    let list = db.menu.filter(
      (m) =>
        (cat === "All" || m.category === cat) &&
        (diet === "all" || (diet === "veg" ? m.veg : !m.veg)) &&
        m.name.toLowerCase().includes(q.toLowerCase().trim()),
    );
    if (sort === "low")
      list = [...list].sort((a, b) => itemPrice(a, s.outletId) - itemPrice(b, s.outletId));
    if (sort === "high")
      list = [...list].sort((a, b) => itemPrice(b, s.outletId) - itemPrice(a, s.outletId));
    if (sort === "popular")
      list = [...list].sort(
        (a, b) => Number(b.badge === "Bestseller") - Number(a.badge === "Bestseller"),
      );
    return list;
  }, [db.menu, cat, diet, q, sort, s.outletId]);

  return (
    <ShopLayout>
      <div className="bg-hero grain text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6">
          <h1 className="text-5xl font-bold sm:text-6xl">The menu</h1>
          <p className="mt-2 text-primary-foreground/80">
            {outlet ? (
              <>
                Ordering from <b className="text-secondary">{outlet.short}</b> · ~
                {outlet.waitMinutes} min
              </>
            ) : (
              <>
                Prices may vary by outlet.{" "}
                <Link to="/outlets" className="font-semibold text-secondary underline">
                  Pick yours
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="sticky top-16 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <LayoutGroup>
            <div
              className="no-scrollbar flex gap-1 overflow-x-auto py-3"
              role="tablist"
              aria-label="Categories"
            >
              {(["All", ...CATEGORIES] as const).map((c) => (
                <button
                  key={c}
                  role="tab"
                  aria-selected={cat === c}
                  onClick={() => setCat(c)}
                  className={cn(
                    "relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition",
                    cat === c ? "text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {cat === c && (
                    <motion.span
                      layoutId="cat-pill"
                      className="absolute inset-0 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative">{c}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <label className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <span className="sr-only">Search menu</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search pizzas, sides…"
                className="h-10 w-full rounded-full border-2 border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <div className="flex rounded-full bg-muted p-1" role="group" aria-label="Diet filter">
              {(["all", "veg", "nonveg"] as Diet[]).map((d) => (
                <button
                  key={d}
                  aria-pressed={diet === d}
                  onClick={() => setDiet(d)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                    diet === d && "bg-card shadow-warm",
                  )}
                >
                  {d !== "all" && <VegDot veg={d === "veg"} />}
                  {d === "all" ? "All" : d === "veg" ? "Veg" : "Non-veg"}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort"
              className="h-10 rounded-full border-2 border-input bg-card px-3 text-sm font-semibold"
            >
              <option value="popular">Popular</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {items.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display text-3xl">Nothing matches that.</p>
            <p className="mt-1 text-muted-foreground">Even the bear looked twice.</p>
            <button
              className="mt-4 font-semibold text-primary underline"
              onClick={() => {
                setQ("");
                setDiet("all");
                setCat("All");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((m, i) => (
              <MenuCard key={m.id} item={m} outletId={s.outletId} index={i} />
            ))}
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
