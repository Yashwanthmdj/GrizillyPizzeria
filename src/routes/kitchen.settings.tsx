import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useKitchenOutletId } from "@/components/staff/StaffShell";
import { useDB } from "@/services/store";
import { updateOutlet } from "@/services/api";
import type { Outlet } from "@/services/types";
import { isOpenNow, isWithinHours } from "@/services/outlet-status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kitchen/settings")({ component: Settings });

export function OutletControls({ outlet }: { outlet: Outlet }) {
  const fallback = outlet.minutesPerOrder ?? outlet.fallbackWaitMinutes ?? 10;
  const set = (p: Partial<Outlet>, msg: string) => {
    updateOutlet(outlet.id, p);
    toast(msg);
  };
  return (
    <div className="space-y-6">
      <div>
        <p className="text-lg font-bold">Minutes for one order</p>
        <p className="text-sm text-muted-foreground">
          Every ticket in the queue gets this slot. Five orders ahead and this is 10 min → the next
          customer waits 60 min.
        </p>
        <p className="mt-2 text-sm font-semibold">
          {outlet.queueLength ?? 0} in queue · next customer ~{outlet.waitMinutes} min
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[5, 10, 15, 20, 30].map((m) => (
            <button
              key={m}
              onClick={() => set({ waitMinutes: m }, `Each order is ${m} min`)}
              aria-pressed={fallback === m}
              className={cn(
                "h-14 min-w-20 rounded-2xl border-2 px-4 text-lg font-bold transition active:scale-95",
                fallback === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background",
              )}
            >
              {m}m
            </button>
          ))}
          <label className="flex items-center gap-2 rounded-2xl border-2 border-border px-3">
            <span className="text-sm">Custom</span>
            <input
              type="number"
              min={1}
              max={120}
              defaultValue={fallback}
              key={fallback}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v >= 1 && v <= 120 && v !== fallback)
                  set({ waitMinutes: v }, `Each order is ${v} min`);
              }}
              className="h-12 w-20 bg-transparent text-lg font-bold outline-none"
            />
          </label>
        </div>
      </div>
      <Toggle
        label="Outlet open"
        desc={
          isWithinHours(outlet)
            ? "Customers can order. Turn off to close the den."
            : "Outside printed hours. Turn this on to open anyway."
        }
        checked={isOpenNow(outlet)}
        onChange={(v) =>
          set(
            v ? { isOpen: true, forceOpen: true } : { isOpen: false, forceOpen: false },
            v ? "Outlet opened — customers can order now" : "Outlet closed",
          )
        }
      />
      <Toggle
        label="Pause new orders"
        desc="Stops new online orders, keeps the board running."
        checked={outlet.pauseOrders}
        onChange={(v) => set({ pauseOrders: v }, v ? "New orders paused" : "Orders resumed")}
      />
    </div>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl bg-muted/60 p-4">
      <span>
        <b className="block text-lg">{label}</b>
        <span className="text-sm text-muted-foreground">{desc}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} className="scale-125" />
    </label>
  );
}

function Settings() {
  const db = useDB();
  const id = useKitchenOutletId();
  const outlet = db.outlets.find((o) => o.id === id)!;
  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-card p-6 shadow-warm">
      <h1 className="text-3xl font-bold">{outlet.short} settings</h1>
      <div className="mt-6">
        <OutletControls outlet={outlet} />
      </div>
    </div>
  );
}
