import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { EASE, Img, VegDot } from "@/components/brand";
import { useSession } from "@/services/store";
import { addToCart } from "@/services/api";
import { useShopUI } from "./ui-context";
import { ItemCustomizer } from "./ItemCustomizer";

export function ItemSheet() {
  const { activeItem: item, openItem, flyToCart } = useShopUI();
  const s = useSession();
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!item) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && openItem(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [item, openItem]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-cocoa/55 backdrop-blur-sm"
            onClick={() => openItem(null)}
          />
          <motion.div
            layoutId={`card-${item.id}`}
            role="dialog"
            aria-modal="true"
            aria-label={item.name}
            className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-background pb-[env(safe-area-inset-bottom)] shadow-lift sm:max-w-lg sm:rounded-3xl"
            transition={{ duration: 0.45, ease: EASE }}
          >
            <div ref={imgRef} className="relative aspect-[4/3] max-h-[42dvh] w-full shrink-0 bg-white sm:aspect-[5/4]">
              <Img src={item.image} alt={item.name} className="size-full p-3 sm:p-5" />
              <button
                onClick={() => openItem(null)}
                className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-card/90 shadow-warm"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center gap-2">
                <VegDot veg={item.veg} />
                <h2 className="text-2xl font-bold">{item.name}</h2>
              </div>
              <p className="mt-1 text-muted-foreground">{item.description}</p>
              <ItemCustomizer
                item={item}
                outletId={s.outletId}
                onAdd={(line) => {
                  addToCart(line);
                  flyToCart(imgRef.current, item.image);
                  toast.success(`${item.name} is in the box`);
                  openItem(null);
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
