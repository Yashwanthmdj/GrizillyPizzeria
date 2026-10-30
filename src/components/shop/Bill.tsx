import { inr } from "@/services/pricing";
import type { CartLine } from "@/services/types";

export function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${bold ? "text-lg font-bold" : "text-sm"}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

export function BillLines({ lines }: { lines: CartLine[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {lines.map((l) => (
        <li key={l.key} className="flex justify-between gap-3">
          <span>
            {l.qty} × {l.name}
            {(l.size || l.toppings.length > 0) && (
              <span className="block text-xs text-muted-foreground">
                {[l.size, ...l.toppings].filter(Boolean).join(" · ")}
              </span>
            )}
          </span>
          <span className="shrink-0">{inr(l.unitPrice * l.qty)}</span>
        </li>
      ))}
    </ul>
  );
}
