import { Clock, MapPin, Timer, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { busyness, canOrder, isOpenNow } from "@/services/outlet-status";
import type { Order, Outlet } from "@/services/types";
import { cn } from "@/lib/utils";

export function OutletCard({
  outlet,
  orders,
  selected,
  onSelect,
}: {
  outlet: Outlet;
  orders: Order[];
  selected?: boolean;
  onSelect?: () => void;
}) {
  const open = isOpenNow(outlet);
  const b = busyness(outlet, orders);
  return (
    <motion.article
      whileHover={{ y: -4 }}
      className={cn(
        "rounded-3xl border-2 bg-card p-6 shadow-warm transition",
        selected ? "border-primary" : "border-transparent",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
            open ? "bg-success text-success-foreground" : "bg-cocoa text-cream",
          )}
        >
          <span className={cn("size-2 rounded-full bg-current", open && "animate-pulse")} />{" "}
          {open ? (outlet.pauseOrders ? "Open · orders paused" : "Open now") : "Closed"}
        </span>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-bold",
            b.label === "Busy" ? "bg-warning text-warning-foreground" : "bg-muted",
          )}
        >
          {b.label} · {b.active} cooking
        </span>
      </div>
      <h3 className="mt-4 text-2xl font-bold">{outlet.name}</h3>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <MapPin className="size-4 shrink-0 text-primary" />
          {outlet.address}
        </li>
        <li className="flex gap-2">
          <Clock className="size-4 shrink-0 text-primary" />
          {outlet.hours}
        </li>
        <li className="flex gap-2">
          <Timer className="size-4 shrink-0 text-primary" />
          Wait time <b className="text-foreground">~{outlet.waitMinutes} min</b>
        </li>
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        {onSelect && (
          <Button
            onClick={onSelect}
            disabled={!canOrder(outlet)}
            variant={selected ? "success" : "default"}
          >
            {selected ? (
              <>
                <Check /> Selected
              </>
            ) : (
              "Order from here"
            )}
          </Button>
        )}
        <Button variant="outline" asChild>
          <a href={outlet.mapUrl} target="_blank" rel="noreferrer">
            Directions
          </a>
        </Button>
      </div>
    </motion.article>
  );
}
