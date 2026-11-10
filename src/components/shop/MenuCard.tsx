import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { EASE, Img, VegDot } from "@/components/brand";
import { itemSlug } from "@/services/slug";
import { inr, itemPrice } from "@/services/pricing";
import type { MenuItem } from "@/services/types";
import { useShopUI } from "./ui-context";
import { cn } from "@/lib/utils";

const BADGE: Record<string, string> = {
  Bestseller: "bg-secondary text-primary-deep",
  Spicy: "bg-primary text-primary-foreground",
  New: "bg-cocoa text-cream",
};

export function MenuCard({
  item,
  outletId,
  index = 0,
}: {
  item: MenuItem;
  outletId: string | null;
  index?: number;
}) {
  const { openItem } = useShopUI();
  const soldOut = !!outletId && !item.availability[outletId];
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: Math.min(index, 8) * 0.05 }}
      whileHover={{ y: -6 }}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-3xl bg-card text-left shadow-warm transition-shadow hover:shadow-lift",
        soldOut && "opacity-60 grayscale",
      )}
    >
      <button
        type="button"
        onClick={() => openItem(item)}
        className="relative block aspect-[4/3] overflow-hidden bg-white text-left sm:aspect-[5/4]"
        aria-label={`Customize ${item.name}`}
      >
        <Img
          src={item.image}
          alt=""
          className="size-full transition-transform duration-500 group-hover:scale-110"
        />
        {item.badge && (
          <span
            className={cn(
              "absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold",
              BADGE[item.badge],
            )}
          >
            {item.badge}
          </span>
        )}
        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-cocoa/80 py-1.5 text-center text-sm font-bold text-cream">
            Sold out at this outlet
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <VegDot veg={item.veg} />
          <h3 className="min-w-0 text-base font-semibold leading-tight sm:text-lg">
            <Link
              to="/menu/$slug"
              params={{ slug: itemSlug(item.name, item.id) }}
              className="line-clamp-2 break-words hover:underline"
            >
              {item.name}
            </Link>
          </h3>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-display text-xl text-primary">
            {inr(itemPrice(item, outletId))}
          </span>
          <button
            type="button"
            onClick={() => openItem(item)}
            aria-label={`Add ${item.name}`}
            className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground transition group-hover:rotate-90"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
