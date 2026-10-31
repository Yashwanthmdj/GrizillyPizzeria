import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { playCrisp } from "@/lib/crisp-sound";
import { useSession } from "@/services/store";

export function WelcomeCrisp() {
  const { phone, customerName } = useSession();
  const greeted = useRef(false);

  useEffect(() => {
    if (!phone || greeted.current) return;
    const key = `gp-crisp-${phone}`;
    if (sessionStorage.getItem(key)) {
      greeted.current = true;
      return;
    }
    greeted.current = true;
    sessionStorage.setItem(key, "1");
    const name = customerName?.trim().split(/\s+/)[0] || "friend";
    playCrisp(0.28);
    toast.custom(
      () => (
        <div className="rounded-2xl bg-cocoa px-5 py-4 text-cream shadow-lift">
          <p className="font-display text-xl">Hey {name}.</p>
          <p className="mt-0.5 text-sm text-cream/70">Oven’s hot. Your name’s on the ticket.</p>
        </div>
      ),
      { duration: 4200 },
    );
  }, [phone, customerName]);

  return null;
}
