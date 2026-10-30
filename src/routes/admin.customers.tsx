import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { StoreGate, fieldCls } from "@/components/admin/ui";
import { adjustPoints } from "@/services/api";
import { inr } from "@/services/pricing";
import { useDB } from "@/services/store";
import type { Customer } from "@/services/types";

const schema = z.object({
  delta: z
    .number()
    .int()
    .refine((n) => n !== 0, "Enter a non-zero adjustment."),
  reason: z.string().min(3, "Add a short reason."),
});

export const Route = createFileRoute("/admin/customers")({
  component: () => (
    <StoreGate>
      <CustomersAdmin />
    </StoreGate>
  ),
});

function CustomersAdmin() {
  const db = useDB();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Customer | null>(null);
  const [delta, setDelta] = useState(10);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const rows = useMemo(
    () =>
      db.customers.filter((c) =>
        `${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase().trim()),
      ),
    [db.customers, q],
  );
  const current = open ? (db.customers.find((c) => c.phone === open.phone) ?? null) : null;
  const history = current ? db.orders.filter((o) => o.phone === current.phone) : [];

  return (
    <div>
      <h1 className="text-4xl">Customers</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name or phone"
        aria-label="Search customers"
        className={`${fieldCls} mt-4 max-w-sm`}
      />
      {rows.length === 0 ? (
        <p className="mt-6 rounded-3xl border-2 border-dashed p-10 text-center font-display text-2xl">
          No customers match.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((customer) => (
            <li key={customer.phone}>
              <button
                type="button"
                onClick={() => setOpen(customer)}
                className="flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3 text-left shadow-warm"
              >
                <span>
                  <b>{customer.name}</b>
                  <span className="block text-xs text-muted-foreground">{customer.phone}</span>
                </span>
                <span className="text-sm font-semibold">
                  {customer.points} pts · {customer.visits} visits
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {current && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-cocoa/40"
          onClick={() => setOpen(null)}
        >
          <aside
            role="dialog"
            aria-label={current.name}
            className="h-full w-full max-w-md overflow-y-auto bg-background p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-3xl">{current.name}</h2>
              <Button variant="outline" onClick={() => setOpen(null)}>
                Close
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {current.phone}
              {current.email ? ` · ${current.email}` : ""}
            </p>
            <p className="mt-3 font-display text-4xl text-primary">{current.points} pts</p>
            <p className="text-sm">
              Lifetime {current.lifetimePoints} · {current.visits} visits · streak {current.streak}
            </p>
            <form
              className="mt-4 space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const parsed = schema.safeParse({ delta, reason });
                if (!parsed.success) {
                  setError(parsed.error.issues[0]?.message ?? "Check the adjustment.");
                  return;
                }
                setError("");
                await adjustPoints(current.phone, parsed.data.delta, parsed.data.reason);
                toast.success("Points updated");
                setReason("");
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="Point change"
                  type="number"
                  value={delta}
                  onChange={(e) => setDelta(Number(e.target.value))}
                  className={fieldCls}
                />
                <input
                  aria-label="Reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason"
                  className={fieldCls}
                />
              </div>
              {error && (
                <p className="text-sm font-semibold text-primary" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit">Adjust points</Button>
            </form>
            <h3 className="mt-6 text-lg">Point history</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {current.history.length === 0 && (
                <li className="text-muted-foreground">No point activity yet.</li>
              )}
              {current.history.map((entry, i) => (
                <li key={`${entry.at}-${i}`}>
                  {entry.delta > 0 ? "+" : ""}
                  {entry.delta} · {entry.label}
                </li>
              ))}
            </ul>
            <h3 className="mt-6 text-lg">Orders</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {history.length === 0 && <li className="text-muted-foreground">No orders yet.</li>}
              {history.map((order) => (
                <li key={order.id}>
                  #{order.number} · {order.status} · {inr(order.total)}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
