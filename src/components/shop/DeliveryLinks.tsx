import { useDB } from "@/services/store";
import { cn } from "@/lib/utils";

export function DeliveryLinks({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const { zomatoUrl, swiggyUrl } = useDB().settings;
  const zomato = zomatoUrl?.trim();
  const swiggy = swiggyUrl?.trim();
  if (!zomato && !swiggy) return null;

  const base =
    tone === "dark"
      ? "rounded-full px-4 py-2 text-sm font-bold transition"
      : "rounded-full px-4 py-2 text-sm font-bold shadow-warm transition";

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {zomato && (
        <a
          href={zomato}
          target="_blank"
          rel="noreferrer"
          className={cn(
            base,
            tone === "dark"
              ? "bg-[#E23744] text-white hover:brightness-110"
              : "bg-[#E23744] text-white hover:brightness-110",
          )}
        >
          Order on Zomato
        </a>
      )}
      {swiggy && (
        <a
          href={swiggy}
          target="_blank"
          rel="noreferrer"
          className={cn(
            base,
            tone === "dark"
              ? "bg-[#FC8019] text-white hover:brightness-110"
              : "bg-[#FC8019] text-white hover:brightness-110",
          )}
        >
          Order on Swiggy
        </a>
      )}
    </div>
  );
}
