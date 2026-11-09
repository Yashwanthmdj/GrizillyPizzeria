import { cn } from "@/lib/utils";

export function ZomatoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4 shrink-0", className)}>
      <circle cx="12" cy="12" r="10" fill="#fff" />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fill="#E23744"
        fontSize="13"
        fontWeight="700"
        fontFamily="Georgia, serif"
      >
        Z
      </text>
    </svg>
  );
}

export function SwiggyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4 shrink-0", className)}>
      <circle cx="12" cy="12" r="10" fill="#fff" />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fill="#FC8019"
        fontSize="13"
        fontWeight="700"
        fontFamily="Georgia, serif"
      >
        S
      </text>
    </svg>
  );
}

export function DeliveryMarks({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E23744] px-2 py-1 text-[11px] font-bold text-white ring-1 ring-white/80">
        <ZomatoMark /> Zomato
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FC8019] px-2 py-1 text-[11px] font-bold text-white ring-1 ring-white/80">
        <SwiggyMark /> Swiggy
      </span>
    </span>
  );
}
