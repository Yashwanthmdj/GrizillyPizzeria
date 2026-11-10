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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => e.key === "Escape" && openItem(null);
    window.addEventListener("keydown", k);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", k);
    };
  }, [item, openItem]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-50 flex w-full max-w-[100vw] items-end justify-center overflow-hidden md:items-center md:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-cocoa/55 backdrop-blur-sm"
            onClick={() => openItem(null)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={item.name}
            className="relative flex max-h-[92dvh] w-full max-w-[100vw] flex-col overflow-hidden rounded-t-3xl bg-background pb-[env(safe-area-inset-bottom)] shadow-lift md:max-h-[min(90dvh,52rem)] md:max-w-lg md:rounded-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-border md:hidden" aria-hidden />
            <div
              ref={imgRef}
              className="relative aspect-[4/3] max-h-[36dvh] w-full shrink-0 bg-white sm:max-h-[40dvh] md:aspect-[5/4]"
            >
              <Img src={item.image} alt={item.name} className="size-full p-3 sm:p-5" />
              <button
                type="button"
                onClick={() => openItem(null)}
                className="absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-card/90 shadow-warm"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
              <div className="flex items-center gap-2">
                <VegDot veg={item.veg} />
                <h2 className="text-xl font-bold sm:text-2xl">{item.name}</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">{item.description}</p>
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
