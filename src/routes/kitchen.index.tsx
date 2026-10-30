import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellOff, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VegDot } from "@/components/brand";
import { SyncBadge } from "@/components/staff/SyncBadge";
import { useKitchenOutletId } from "@/components/staff/StaffShell";
import { useDB } from "@/services/store";
import { setOrderStatus, simulateOrder } from "@/services/api";
import { inr } from "@/services/pricing";
import type { Order, OrderStatus } from "@/services/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kitchen/")({ component: Board });

const COLS: { status: OrderStatus; title: string }[] = [
  { status: "Placed", title: "New" },
  { status: "Accepted", title: "Accepted" },
  { status: "Preparing", title: "Preparing" },
  { status: "Ready", title: "Ready" },
];
const REASONS = ["Out of ingredients", "Kitchen overloaded", "Closing soon", "Suspicious order"];

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.16);
    });
  } catch {
    /* audio unavailable */
  }
}

function useNow(ms = 15000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

function Board() {
  const db = useDB();
  const outletId = useKitchenOutletId();
  const [sound, setSound] = useState(true);
  const [alert, setAlert] = useState<number | null>(null);
  const now = useNow();
  const orders = db.orders.filter(
    (o) =>
      o.outletId === outletId && ["Placed", "Accepted", "Preparing", "Ready"].includes(o.status),
  );
  const newCount = orders.filter((o) => o.status === "Placed").length;
  const seen = useRef<Set<string>>(new Set(orders.map((o) => o.id)));

  useEffect(() => {
    const fresh = orders.filter((o) => o.status === "Placed" && !seen.current.has(o.id));
    orders.forEach((o) => seen.current.add(o.id));
    if (fresh.length) {
      setAlert(fresh[0]!.number);
      if (sound) beep();
      const t = setTimeout(() => setAlert(null), 6000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [orders, sound]);

  return (
    <div>
      <AnimatePresence>
        {alert && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            role="alert"
            className="mb-4 flex items-center gap-3 rounded-2xl bg-primary px-5 py-4 text-lg font-bold text-primary-foreground shadow-lift"
          >
            <Bell className="animate-bounce" /> New order #{alert} just landed!
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">Live orders</h1>
        <SyncBadge tick={`${orders.map((o) => o.id + o.status).join("|")}`} />
        <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
          {newCount} new
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setSound((s) => !s)}
            aria-pressed={sound}
          >
            {sound ? <Bell /> : <BellOff />} Sound {sound ? "on" : "off"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={async () => {
              const o = await simulateOrder(outletId);
              toast(`Simulated order #${o.number}`);
            }}
          >
            <Plus /> Simulate new order
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLS.map((c) => {
          const list = orders
            .filter((o) => o.status === c.status)
            .sort((a, b) => a.createdAt - b.createdAt);
          return (
            <section key={c.status} className="rounded-3xl bg-muted/50 p-3" aria-label={c.title}>
              <h2 className="flex items-center justify-between px-2 pb-3 text-xl font-bold">
                {c.title}
                <span className="rounded-full bg-card px-2.5 text-base">{list.length}</span>
              </h2>
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {list.map((o) => (
                    <OrderCard key={o.id} o={o} now={now} />
                  ))}
                </AnimatePresence>
                {list.length === 0 && (
                  <p className="rounded-2xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
                    All clear
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({ o, now }: { o: Order; now: number }) {
  const [rejecting, setRejecting] = useState(false);
  const mins = Math.floor((now - o.createdAt) / 6e4);
  const left = Math.round((o.promisedAt - now) / 6e4);
  const late = left < 0;
  const tight = left >= 0 && left <= 5;
  const act = async (s: OrderStatus, r?: string) => {
    try {
      await setOrderStatus(o.id, s, r);
      toast(`#${o.number} → ${s}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "rounded-2xl border-2 bg-card p-4 shadow-warm",
        o.status === "Placed"
          ? "border-primary animate-[pulse_2s_ease-in-out_3]"
          : "border-transparent",
        late && "border-primary",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-3xl">#{o.number}</p>
          <p className="text-sm text-muted-foreground">
            {o.customerName} · {mins}m ago
          </p>
        </div>
        <div className="text-right">
          <span
            className={cn(
              "inline-block rounded-full px-2.5 py-1 text-xs font-bold",
              o.payment === "online"
                ? "bg-success text-success-foreground"
                : "bg-warning text-warning-foreground",
            )}
          >
            {o.payment === "online" ? "PAID ONLINE" : "PAY AT COUNTER"}
          </span>
          <p
            className={cn(
              "mt-1 text-sm font-bold",
              late ? "text-primary" : tight ? "text-warning" : "text-muted-foreground",
            )}
          >
            {late ? `${-left}m LATE` : `${left}m left`}
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 border-t pt-3">
        {o.lines.map((l) => (
          <li key={l.key} className="text-base">
            <span className="flex items-center gap-2 font-semibold">
              <VegDot veg={l.veg} />
              {l.qty}× {l.name}
              {l.size ? ` (${l.size})` : ""}
            </span>
            {l.toppings.length > 0 && (
              <span className="ml-6 block text-sm text-muted-foreground">
                + {l.toppings.join(", ")}
              </span>
            )}
            {l.note && <span className="ml-6 block text-sm text-warning">“{l.note}”</span>}
          </li>
        ))}
      </ul>
      {o.notes && <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-sm">📝 {o.notes}</p>}
      <p className="mt-2 text-sm text-muted-foreground">{inr(o.total)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {o.status === "Placed" && !rejecting && (
          <>
            <Button size="lg" variant="success" className="flex-1" onClick={() => act("Accepted")}>
              Accept
            </Button>
            <Button size="lg" variant="outline" onClick={() => setRejecting(true)}>
              Reject
            </Button>
          </>
        )}
        {rejecting && (
          <div className="w-full space-y-2">
            <p className="text-sm font-semibold">Why reject?</p>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <Button key={r} size="sm" variant="destructive" onClick={() => act("Rejected", r)}>
                  {r}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        )}
        {o.status === "Accepted" && (
          <Button size="lg" className="flex-1" onClick={() => act("Preparing")}>
            Start preparing
          </Button>
        )}
        {o.status === "Preparing" && (
          <Button size="lg" variant="warning" className="flex-1" onClick={() => act("Ready")}>
            Mark ready
          </Button>
        )}
        {o.status === "Ready" && (
          <Button size="lg" variant="success" className="flex-1" onClick={() => act("Collected")}>
            Handed over
          </Button>
        )}
      </div>
    </motion.article>
  );
}
