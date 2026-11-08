import { useDB } from "@/services/store";
import { cn } from "@/lib/utils";

export function DeliveryLinks({
  className,
  tone = "light",
  /** Always render both brand buttons; inactive until admin sets a URL. */
  alwaysShow = false,
}: {
  className?: string;
  tone?: "light" | "dark";
  alwaysShow?: boolean;
}) {
  const { zomatoUrl, swiggyUrl } = useDB().settings;
  const zomato = zomatoUrl?.trim();
  const swiggy = swiggyUrl?.trim();
  if (!alwaysShow && !zomato && !swiggy) return null;

  const base =
    tone === "dark"
      ? "rounded-full px-4 py-2 text-sm font-bold transition"
      : "rounded-full px-4 py-2 text-sm font-bold shadow-warm transition";

  const items = [
    { label: "Order on Zomato", href: zomato, className: "bg-[#E23744] text-white hover:brightness-110" },
    { label: "Order on Swiggy", href: swiggy, className: "bg-[#FC8019] text-white hover:brightness-110" },
  ].filter((item) => alwaysShow || item.href);

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) =>
        item.href ? (
          <a
            key={item.label}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className={cn(base, item.className)}
          >
            {item.label}
          </a>
        ) : (
          <span
            key={item.label}
            title="Link coming soon"
            className={cn(base, item.className, "cursor-default opacity-55")}
          >
            {item.label}
          </span>
        ),
      )}
    </div>
  );
}
