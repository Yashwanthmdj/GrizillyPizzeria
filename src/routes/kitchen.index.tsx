import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VegDot } from "@/components/brand";
import { SyncBadge } from "@/components/staff/SyncBadge";
import { useKitchenOutletId } from "@/components/staff/StaffShell";
import { useDB } from "@/services/store";
import { markCounterCollected, setLineReady, setOrderStatus, updateOutlet } from "@/services/api";
import { inr } from "@/services/pricing";
import { canOrder, isOpenNow } from "@/services/outlet-status";
import { clockedInCount, liveQueue, minutesPerOrder, waitForOrder } from "@/services/wait";
import type { Order, OrderStatus } from "@/services/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kitchen/")({ component: Board });

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
  const orders = liveQueue(db.orders, outletId);
  const newCount = orders.filter((o) => o.status === "Placed").length;
  const cooks = clockedInCount(db.workers, db.attendance, outletId);
  const outlet = db.outlets.find((o) => o.id === outletId);
  const perOrder = minutesPerOrder(outlet);
  const takingOrders = outlet ? canOrder(outlet) : false;
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
      {outlet && !takingOrders && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-warning px-5 py-4 text-warning-foreground">
          <p className="flex-1 font-bold">
            {outlet.pauseOrders
              ? "New orders are paused."
              : isOpenNow(outlet)
                ? "This den is closed to customers."
                : "This den is closed (after hours). Open it to take orders."}
          </p>
          <Button
            size="lg"
            onClick={async () => {
              try {
                await updateOutlet(outlet.id, {
                  isOpen: true,
                  forceOpen: true,
                  pauseOrders: false,
                });
                toast.success(`${outlet.short} is open — customers can order`);
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            Open outlet now
          </Button>
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">Live orders</h1>
        <SyncBadge tick={`${orders.map((o) => o.id + o.status).join("|")}`} />
        <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
          {newCount} new
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold">
          {cooks} on the floor
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold">
          {orders.length} in queue · {perOrder} min each
        </span>
        <div className="flex flex-wrap gap-1">
          {[5, 10, 15, 20, 30].map((m) => (
            <Button
              key={m}
              size="sm"
              variant={perOrder === m ? "default" : "outline"}
              onClick={async () => {
                if (!outlet) return;
                try {
                  await updateOutlet(outlet.id, { waitMinutes: m });
                  toast(`Each order is ${m} min`);
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              {m}m
            </Button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setSound((s) => !s)}
            aria-pressed={sound}
          >
            {sound ? <Bell /> : <BellOff />} Sound {sound ? "on" : "off"}
          </Button>
        </div>
      </div>
      {orders.length > 0 && (
        <p className="mb-3 overflow-x-auto text-sm font-semibold text-muted-foreground">
          Queue · oldest first: {orders.map((o) => `#${o.number}`).join(" → ")}
        </p>
      )}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {orders.map((o, i) => (
            <OrderCard
              key={o.id}
              o={o}
              now={now}
              place={i + 1}
              slot={perOrder}
              readyIn={waitForOrder(db.orders, outletId, o.id, perOrder)}
            />
          ))}
        </AnimatePresence>
        {orders.length === 0 && (
          <p className="rounded-3xl border-2 border-dashed p-10 text-center text-muted-foreground">
            All clear — next ticket waits {perOrder} min
          </p>
        )}
      </div>
    </div>
  );
}

function OrderCard({
  o,
  now,
  place,
  slot,
  readyIn,
}: {
  o: Order;
  now: number;
  place: number;
  slot: number;
  readyIn: number;
}) {
  const [rejecting, setRejecting] = useState(false);
  const mins = Math.floor((now - o.createdAt) / 6e4);
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
        "flex flex-col gap-3 rounded-2xl border-2 bg-card p-4 shadow-warm sm:flex-row",
        o.status === "Placed"
          ? "border-primary animate-[pulse_2s_ease-in-out_3]"
          : "border-transparent",
      )}
    >
      <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-cocoa text-cream">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Queue</span>
        <span className="font-display text-2xl leading-none">{place}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col items-start gap-2 min-[480px]:flex-row min-[480px]:justify-between">
        <div>
          <p className="font-display text-3xl">#{o.number}</p>
          <p className="text-sm text-muted-foreground">
            {o.status === "Ready"
              ? `Ready for pickup · ${o.customerName} · ${mins}m ago`
              : `Ready in ${readyIn} min (${slot} min × queue) · ${o.customerName} · ${mins}m ago`}
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
            {o.payment === "online" ? (o.paid ? "PAID ONLINE" : "PAYMENT PENDING") : o.paid ? "PAID AT COUNTER" : "PAY AT COUNTER"}
          </span>
          <p className="mt-1 text-sm font-bold text-muted-foreground">{o.status}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 border-t pt-3">
        {o.lines.map((l) => (
          <li key={l.lineId || l.key} className="text-base">
            <span className="flex items-center gap-2 font-semibold">
              <VegDot veg={l.veg} />
              <span className="flex-1">
                {l.qty}× {l.name}
                {l.size ? ` (${l.size})` : ""}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                  l.lineStatus === "ready"
                    ? "bg-success text-success-foreground"
                    : l.lineStatus === "collected"
                      ? "bg-muted text-muted-foreground"
                      : "bg-warning/80 text-warning-foreground",
                )}
              >
                {l.lineStatus}
              </span>
            </span>
            {l.toppings.length > 0 && (
              <span className="ml-6 block text-sm text-muted-foreground">
                + {l.toppings.join(", ")}
              </span>
            )}
            {l.note && <span className="ml-6 block text-sm text-warning">“{l.note}”</span>}
            {l.lineStatus !== "collected" && l.lineStatus !== "ready" && o.status !== "Placed" && (
              <Button
                size="sm"
                variant="secondary"
                className="mt-1 ml-6"
                onClick={() => setLineReady(o.id, l.lineId)}
              >
                Mark ready
              </Button>
            )}
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
        {o.payment === "counter" && !o.paid && (
          <Button
            size="lg"
            variant="outline"
            className="flex-1"
            onClick={async () => {
              try {
                await markCounterCollected(o.id);
                toast.success(`#${o.number} payment collected`);
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          >
            Payment collected
          </Button>
        )}
      </div>
      </div>
    </motion.article>
  );
}
