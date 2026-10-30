import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { VegDot } from "@/components/brand";
import { inr, itemPrice, unitPrice } from "@/services/pricing";
import type { CartLine, MenuItem, SizeKey } from "@/services/types";
import { cn } from "@/lib/utils";

export function ItemCustomizer({
  item,
  outletId,
  onAdd,
}: {
  item: MenuItem;
  outletId: string | null;
  onAdd: (line: Omit<CartLine, "key">) => void;
}) {
  const [size, setSize] = useState<SizeKey>("Regular");
  const [tops, setTops] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  useEffect(() => {
    setSize("Regular");
    setTops([]);
    setQty(1);
    setNote("");
  }, [item.id]);

  const chosenSize = item.sizes ? size : undefined;
  const price = unitPrice(item, outletId, chosenSize, tops);
  const soldOut = !!outletId && !item.availability[outletId];

  return (
    <div>
      {item.sizes && (
        <fieldset className="mt-5">
          <legend className="font-display text-lg">Size</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {item.sizes.map((z) => (
              <button
                key={z.key}
                type="button"
                onClick={() => setSize(z.key)}
                aria-pressed={size === z.key}
                className={cn(
                  "min-h-11 rounded-2xl border-2 px-2 py-3 text-sm font-semibold transition",
                  size === z.key
                    ? "border-primary text-primary"
                    : "border-border hover:border-primary/40",
                )}
              >
                {z.key}
                <span className="block text-xs font-normal text-muted-foreground">
                  {inr(itemPrice(item, outletId) + z.extra)}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {item.toppings && (
        <fieldset className="mt-5">
          <legend className="font-display text-lg">Toppings</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.toppings.map((t) => {
              const on = tops.includes(t.name);
              return (
                <button
                  key={t.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setTops((x) => (on ? x.filter((y) => y !== t.name) : [...x, t.name]))
                  }
                  className={cn(
                    "flex min-h-11 items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm transition active:scale-95",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card",
                  )}
                >
                  <VegDot veg={t.veg} /> {t.name} <span className="opacity-70">+{t.price}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <label className="mt-5 block">
        <span className="font-display text-lg">Special note</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={80}
          placeholder="Well done, cut in squares…"
          className="mt-2 h-11 w-full rounded-xl border-2 border-input bg-card px-3 outline-none focus:border-primary"
        />
      </label>
      <div className="mt-5 flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full bg-muted p-1">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full bg-card"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-7 text-center font-bold">{qty}</span>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full bg-card"
            onClick={() => setQty((q) => q + 1)}
            aria-label="Increase quantity"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <Button
          size="lg"
          className="flex-1"
          disabled={soldOut}
          onClick={() =>
            onAdd({
              itemId: item.id,
              name: item.name,
              image: item.image,
              veg: item.veg,
              size: chosenSize,
              toppings: tops,
              note: note.trim() || undefined,
              unitPrice: price,
              qty,
            })
          }
        >
          {soldOut ? (
            "Sold out here"
          ) : (
            <>
              Add · <motion.span key={price * qty}>{inr(price * qty)}</motion.span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
