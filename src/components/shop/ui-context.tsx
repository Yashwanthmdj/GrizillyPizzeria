import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { MenuItem } from "@/services/types";

interface ShopUI {
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  activeItem: MenuItem | null;
  openItem: (m: MenuItem | null) => void;
  bump: number;
  flyToCart: (from: HTMLElement | null, src: string) => void;
}
const Ctx = createContext<ShopUI | null>(null);

export function ShopUIProvider({ children }: { children: ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [activeItem, openItem] = useState<MenuItem | null>(null);
  const [bump, setBump] = useState(0);

  const flyToCart = useCallback((from: HTMLElement | null, src: string) => {
    const target = document.getElementById("cart-target");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!from || !target || reduce) {
      setBump((b) => b + 1);
      return;
    }
    const a = from.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const img = document.createElement("img");
    img.src = src;
    const size = Math.min(a.width, 120);
    Object.assign(img.style, {
      position: "fixed",
      left: `${a.left + a.width / 2 - size / 2}px`,
      top: `${a.top + a.height / 2 - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "999px",
      objectFit: "cover",
      zIndex: "200",
      pointerEvents: "none",
    });
    document.body.appendChild(img);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const anim = img.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy - 80}px) scale(0.6)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.15)`, opacity: 0.6 },
      ],
      { duration: 700, easing: "cubic-bezier(0.22,1,0.36,1)" },
    );
    anim.onfinish = () => {
      img.remove();
      setBump((x) => x + 1);
    };
  }, []);

  return (
    <Ctx.Provider value={{ cartOpen, setCartOpen, activeItem, openItem, bump, flyToCart }}>
      {children}
    </Ctx.Provider>
  );
}

export function useShopUI() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShopUI outside provider");
  return c;
}
