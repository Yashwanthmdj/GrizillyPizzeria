import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useKitchenOutletId } from "@/components/staff/StaffShell";
import { useDB } from "@/services/store";
import { updateOutlet } from "@/services/api";
import type { Outlet } from "@/services/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kitchen/settings")({ component: Settings });

export function OutletControls({ outlet }: { outlet: Outlet }) {
  const set = (p: Partial<Outlet>, msg: string) => {
    updateOutlet(outlet.id, p);
    toast(msg);
  };
  return (
    <div className="space-y-6">
      <div>
        <p className="text-lg font-bold">Current waiting time</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[10, 15, 20, 30, 45].map((m) => (
            <button
              key={m}
              onClick={() => set({ waitMinutes: m }, `Wait time set to ${m} min`)}
              aria-pressed={outlet.waitMinutes === m}
              className={cn(
                "h-14 min-w-20 rounded-2xl border-2 px-4 text-lg font-bold transition active:scale-95",
                outlet.waitMinutes === m
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
              min={5}
              max={120}
              defaultValue={outlet.waitMinutes}
              key={outlet.waitMinutes}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v >= 5 && v <= 120 && v !== outlet.waitMinutes)
                  set({ waitMinutes: v }, `Wait time set to ${v} min`);
              }}
              className="h-12 w-20 bg-transparent text-lg font-bold outline-none"
            />
          </label>
        </div>
      </div>
      <Toggle
        label="Outlet open"
        desc="Customers see you as open."
        checked={outlet.isOpen}
        onChange={(v) => set({ isOpen: v }, v ? "Outlet opened" : "Outlet closed")}
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
