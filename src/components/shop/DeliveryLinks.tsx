import { useDB } from "@/services/store";
import { cn } from "@/lib/utils";
import { SwiggyMark, ZomatoMark } from "./delivery-marks";

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
      ? "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition"
      : "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-warm transition";

  const items = [
    {
      label: "Zomato",
      href: zomato,
      className: "bg-[#E23744] text-white hover:brightness-110",
      mark: <ZomatoMark />,
    },
    {
      label: "Swiggy",
      href: swiggy,
      className: "bg-[#FC8019] text-white hover:brightness-110",
      mark: <SwiggyMark />,
    },
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
            {item.mark}
            Order on {item.label}
          </a>
        ) : (
          <span
            key={item.label}
            title="Link coming soon"
            className={cn(base, item.className, "cursor-default opacity-80")}
          >
            {item.mark}
            Order on {item.label}
          </span>
        ),
      )}
    </div>
  );
}
