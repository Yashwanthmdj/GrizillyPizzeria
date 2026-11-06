import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { BearMark, EASE } from "@/components/brand";
import { STATUS_FLOW, type Order } from "@/services/types";
import { cn } from "@/lib/utils";

export function OrderTracker({ order }: { order: Order }) {
  const idx = Math.max(0, STATUS_FLOW.indexOf(order.status));
  const pct = (idx / (STATUS_FLOW.length - 1)) * 100;
  if (order.status === "Rejected")
    return (
      <div className="rounded-3xl border-2 border-primary bg-accent p-5" role="status">
        <p className="font-display text-2xl text-primary">Order rejected</p>
        <p className="mt-1">Reason: {order.rejectReason ?? "Kitchen couldn't take it"}</p>
        {order.paid && (
          <p className="mt-1 text-sm text-muted-foreground">
            Your online payment will be refunded in 3-5 days.
          </p>
        )}
      </div>
    );
  return (
    <div
      className="rounded-3xl bg-card p-5 shadow-warm sm:p-7"
      role="status"
      aria-label={`Order status: ${order.status}`}
    >
      <div className="relative mx-3 mb-2 mt-10 h-2 rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: EASE }}
        />
        <motion.div
          className="absolute -top-12 -translate-x-1/2"
          initial={false}
          animate={{ left: `${pct}%` }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="grid size-11 place-items-center rounded-full bg-primary shadow-warm"
          >
            <BearMark className="h-8 w-auto" />
          </motion.div>
        </motion.div>
      </div>
      <ol className="mt-4 grid grid-cols-5 gap-1 text-center text-[10px] font-semibold leading-tight sm:text-sm">
        {STATUS_FLOW.map((s, i) => (
          <li
            key={s}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 break-words",
              i <= idx ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full border-2",
                i <= idx ? "border-primary bg-primary text-primary-foreground" : "border-border",
              )}
            >
              {i <= idx ? <Check className="size-3.5" /> : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
