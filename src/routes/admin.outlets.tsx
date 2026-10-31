import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StoreGate, fieldCls } from "@/components/admin/ui";
import { OutletControls } from "@/routes/kitchen.settings";
import { updateOutlet } from "@/services/api";
import { setSession, useDB } from "@/services/store";

export const Route = createFileRoute("/admin/outlets")({
  component: () => (
    <StoreGate>
      <OutletsAdmin />
    </StoreGate>
  ),
});

function OutletsAdmin() {
  const db = useDB();
  const [active, setActive] = useState(db.outlets[0]?.id ?? "o1");
  const outlet = db.outlets.find((o) => o.id === active) ?? db.outlets[0];
  if (!outlet) return <p className="font-display text-2xl">No outlets yet.</p>;

  async function save(patch: {
    address?: string;
    hours?: string;
    phone?: string;
    waitMinutes?: number;
  }) {
    await updateOutlet(outlet!.id, patch);
    toast.success(`${outlet!.short} saved`);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Outlets</h1>
      <div className="flex gap-2" role="tablist" aria-label="Outlet">
        {db.outlets.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={o.id === outlet.id}
            onClick={() => setActive(o.id)}
            className={`h-11 rounded-full px-4 text-sm font-semibold ${o.id === outlet.id ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            {o.short}
          </button>
        ))}
      </div>
      <form
        className="grid gap-4 rounded-3xl bg-card p-5 shadow-warm"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          save({
            address: String(data.get("address") ?? ""),
            hours: String(data.get("hours") ?? ""),
            phone: String(data.get("phone") ?? ""),
            waitMinutes: Number(data.get("wait") ?? outlet.minutesPerOrder ?? 10),
          });
        }}
      >
        <label className="text-sm font-semibold">
          Address
          <input
            name="address"
            key={`${outlet.id}-address`}
            defaultValue={outlet.address}
            className={`${fieldCls} mt-1`}
          />
        </label>
        <label className="text-sm font-semibold">
          Hours
          <input
            name="hours"
            key={`${outlet.id}-hours`}
            defaultValue={outlet.hours}
            className={`${fieldCls} mt-1`}
          />
        </label>
        <label className="text-sm font-semibold">
          Phone
          <input
            name="phone"
            key={`${outlet.id}-phone`}
            defaultValue={outlet.phone}
            className={`${fieldCls} mt-1`}
          />
        </label>
        <label className="text-sm font-semibold">
          Minutes per order
          <input
            name="wait"
            type="number"
            min={5}
            max={120}
            key={`${outlet.id}-wait`}
            defaultValue={outlet.minutesPerOrder ?? outlet.fallbackWaitMinutes ?? 10}
            className={`${fieldCls} mt-1`}
          />
        </label>
        <Button type="submit">Save details</Button>
      </form>
      <div className="rounded-3xl bg-card p-5 shadow-warm">
        <OutletControls outlet={outlet} />
        <p className="mt-3 text-sm">
          {outlet.isOpen ? "Open" : "Closed"} ·{" "}
          {outlet.pauseOrders ? "Orders paused" : "Accepting orders"}
        </p>
        <Button
          asChild
          className="mt-4"
          variant="secondary"
          onClick={() => setSession((s) => ({ ...s, kitchenOutlet: outlet.id }))}
        >
          <Link to="/kitchen">Open {outlet.short} kitchen</Link>
        </Button>
      </div>
    </div>
  );
}
