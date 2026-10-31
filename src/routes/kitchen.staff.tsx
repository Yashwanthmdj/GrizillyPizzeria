import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useKitchenOutletId } from "@/components/staff/StaffShell";
import { useDB } from "@/services/store";
import { addWorker, clockWorker, setWorkerActive } from "@/services/api";
import { clockedInCount } from "@/services/wait";
import type { KitchenWorker } from "@/services/types";

export const Route = createFileRoute("/kitchen/staff")({ component: StaffPage });

function StaffPage() {
  const db = useDB();
  const outletId = useKitchenOutletId();
  const workers = db.workers.filter((w) => w.outletId === outletId && w.active);
  const onFloor = clockedInCount(db.workers, db.attendance, outletId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<KitchenWorker["role"]>("cook");

  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return db.attendance.filter((a) => a.outletId === outletId && a.clockIn >= start.getTime());
  }, [db.attendance, outletId]);

  function openShift(workerId: string) {
    return db.attendance.find((a) => a.workerId === workerId && !a.clockOut);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <section className="rounded-3xl bg-card p-5 shadow-warm">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Kitchen crew</h1>
            <p className="text-sm text-muted-foreground">{onFloor} clocked in today</p>
          </div>
        </div>
        <form
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_120px_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await addWorker({ outletId, name, phone, role });
              toast.success(`${name} added`);
              setName("");
              setPhone("");
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="h-11 rounded-xl border-2 border-input bg-background px-3"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as KitchenWorker["role"])}
            className="h-11 rounded-xl border-2 border-input bg-background px-2"
          >
            <option value="cook">Cook</option>
            <option value="counter">Counter</option>
          </select>
          <Button type="submit" disabled={!name.trim()}>
            Add
          </Button>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="Phone (optional)"
            className="h-11 rounded-xl border-2 border-input bg-background px-3 sm:col-span-2"
          />
        </form>
        <ul className="mt-5 space-y-2">
          {workers.map((w) => {
            const shift = openShift(w.id);
            return (
              <li
                key={w.id}
                className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/60 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{w.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.role} {shift ? "· on shift" : "· off"}
                  </p>
                </div>
                {shift ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await clockWorker(w.id, "out");
                        toast.success(`${w.name} clocked out`);
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  >
                    Clock out
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await clockWorker(w.id, "in");
                        toast.success(`${w.name} clocked in`);
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  >
                    Clock in
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await setWorkerActive(w.id, false);
                      toast(`${w.name} removed`);
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                >
                  Remove
                </Button>
              </li>
            );
          })}
          {workers.length === 0 && (
            <p className="text-sm text-muted-foreground">Add people on the floor, then clock them in.</p>
          )}
        </ul>
        <h2 className="mt-6 text-lg font-bold">Today’s attendance</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {today.map((a) => (
            <li key={a.id} className="flex justify-between gap-2">
              <span>{a.workerName}</span>
              <span className="text-muted-foreground">
                {new Date(a.clockIn).toLocaleTimeString("en-IN", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {a.clockOut
                  ? ` – ${new Date(a.clockOut).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}`
                  : " – now"}
              </span>
            </li>
          ))}
          {today.length === 0 && (
            <li className="text-muted-foreground">No clocks yet today.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
