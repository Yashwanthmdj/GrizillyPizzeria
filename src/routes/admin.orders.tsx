import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StoreGate, fieldCls } from "@/components/admin/ui";
import { setOrderStatus } from "@/services/api";
import { nextStatuses } from "@/services/orders";
import { inr } from "@/services/pricing";
import { useDB } from "@/services/store";
import type { Order, OrderStatus } from "@/services/types";

export const Route = createFileRoute("/admin/orders")({
  component: () => (
    <StoreGate>
      <OrdersAdmin />
    </StoreGate>
  ),
});

function OrdersAdmin() {
  const db = useDB();
  const [q, setQ] = useState("");
  const [outlet, setOutlet] = useState("all");
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const [day, setDay] = useState("");
  const [open, setOpen] = useState<Order | null>(null);
  const [reason, setReason] = useState("Out of ingredients");

  const rows = useMemo(() => {
    return db.orders.filter((order) => {
      const hay = `${order.number} ${order.customerName} ${order.phone}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase().trim())) return false;
      if (outlet !== "all" && order.outletId !== outlet) return false;
      if (status !== "all" && order.status !== status) return false;
      if (payment !== "all" && order.payment !== payment) return false;
      if (day && new Date(order.createdAt).toISOString().slice(0, 10) !== day) return false;
      return true;
    });
  }, [db.orders, q, outlet, status, payment, day]);

  const current = open ? (db.orders.find((o) => o.id === open.id) ?? open) : null;

  async function move(order: Order, next: OrderStatus) {
    try {
      await setOrderStatus(order.id, next, next === "Rejected" ? reason : undefined);
      toast.success(`#${order.number} → ${next}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div>
      <h1 className="text-4xl">Orders</h1>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search number, name, phone"
          aria-label="Search orders"
          className={fieldCls}
        />
        <select
          value={outlet}
          onChange={(e) => setOutlet(e.target.value)}
          aria-label="Outlet"
          className={fieldCls}
        >
          <option value="all">All outlets</option>
          {db.outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.short}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Status"
          className={fieldCls}
        >
          <option value="all">All statuses</option>
          {["Placed", "Accepted", "Preparing", "Ready", "Collected", "Rejected"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
          aria-label="Payment"
          className={fieldCls}
        >
          <option value="all">All payments</option>
          <option value="online">Online</option>
          <option value="counter">Pay at counter</option>
        </select>
        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          aria-label="Date"
          className={fieldCls}
        />
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-3xl border-2 border-dashed p-10 text-center font-display text-2xl">
          No orders match those filters.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-3xl bg-card shadow-warm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th>Customer</th>
                <th>Outlet</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id} className="border-t">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="font-display text-lg text-primary"
                      onClick={() => setOpen(order)}
                    >
                      #{order.number}
                    </button>
                  </td>
                  <td>
                    {order.customerName}
                    <span className="block text-xs text-muted-foreground">{order.phone}</span>
                  </td>
                  <td>{db.outlets.find((o) => o.id === order.outletId)?.short}</td>
                  <td>{order.status}</td>
                  <td>{order.payment === "online" ? "Online" : "Counter"}</td>
                  <td>{inr(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {current && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-cocoa/40"
          role="presentation"
          onClick={() => setOpen(null)}
        >
          <aside
            role="dialog"
            aria-label={`Order ${current.number}`}
            className="h-full w-full max-w-md overflow-y-auto bg-background p-5 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-3xl">#{current.number}</h2>
              <Button variant="outline" onClick={() => setOpen(null)}>
                Close
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {current.customerName} · {current.phone}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {current.lines.map((line) => (
                <li key={line.key}>
                  <b>
                    {line.qty}× {line.name}
                  </b>
                  <span className="block text-muted-foreground">
                    {[line.size, ...line.toppings, line.note].filter(Boolean).join(" · ") ||
                      "No extras"}
                  </span>
                </li>
              ))}
            </ul>
            <h3 className="mt-5 text-lg">Status history</h3>
            <ol className="mt-2 space-y-1 text-sm">
              {current.history.map((entry, i) => (
                <li key={`${entry.status}-${i}`}>
                  {entry.status} · {new Date(entry.at).toLocaleString("en-IN")}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm">
              Payment: {current.payment === "online" ? "Online" : "Pay at counter"} ·{" "}
              {current.paid ? "Paid" : "Not collected"}
            </p>
            <p className="text-sm">
              QR:{" "}
              {current.payment !== "online"
                ? "No QR (counter order)"
                : current.qrUsed
                  ? "Used"
                  : "Not used yet"}
            </p>
            <p className="text-sm">
              Points used {current.pointsUsed} · earned {current.pointsEarned}
            </p>
            {current.rejectReason && <p className="mt-2 text-sm">Reason: {current.rejectReason}</p>}
            {nextStatuses(current.status).length > 0 && (
              <div className="mt-5 space-y-2">
                <label className="block text-sm font-semibold">
                  Reject reason
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={`${fieldCls} mt-1`}
                  >
                    {[
                      "Out of ingredients",
                      "Kitchen overloaded",
                      "Closing soon",
                      "Customer cancelled",
                    ].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  {nextStatuses(current.status).map((next) => (
                    <Button
                      key={next}
                      variant={next === "Rejected" ? "destructive" : "default"}
                      onClick={() => move(current, next)}
                    >
                      {next}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
