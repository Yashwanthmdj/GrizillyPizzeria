import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CameraOff, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useKitchenOutletId } from "@/components/staff/StaffShell";
import { SyncBadge } from "@/components/staff/SyncBadge";
import { confirmPickup, verifyScan, type ScanResult } from "@/services/api";

export const Route = createFileRoute("/kitchen/scan")({ component: Scan });

function Scan() {
  const outletId = useKitchenOutletId();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manual, setManual] = useState("");
  const [cam, setCam] = useState(false);
  const scanner = useRef<{ stop: () => Promise<void> } | null>(null);
  const busy = useRef(false);

  async function check(raw: string) {
    if (busy.current) return;
    busy.current = true;
    setResult(await verifyScan(raw, outletId));
    setTimeout(() => (busy.current = false), 1500);
  }

  useEffect(() => {
    if (!cam) return;
    let cancelled = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const h = new Html5Qrcode("qr-reader");
      try {
        await h.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          (txt) => check(txt),
          () => {},
        );
        scanner.current = { stop: () => h.stop() };
      } catch {
        toast.error("Couldn't open the camera. Use the order number instead.");
        setCam(false);
      }
    })();
    return () => {
      cancelled = true;
      scanner.current?.stop().catch(() => {});
      scanner.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam, outletId]);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
      <section className="rounded-3xl bg-card p-5 shadow-warm">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Scan pickup QR</h1>
          <SyncBadge tick={result ? (result.ok ? result.order.id : result.reason) : "idle"} />
        </div>
        <div id="qr-reader" className="mt-4 aspect-square overflow-hidden rounded-2xl bg-muted">
          {!cam && (
            <div className="grid size-full place-items-center text-muted-foreground">
              <Camera className="size-16" />
            </div>
          )}
        </div>
        <Button
          size="xl"
          className="mt-4 w-full"
          variant={cam ? "outline" : "default"}
          onClick={() => setCam((c) => !c)}
        >
          {cam ? (
            <>
              <CameraOff /> Stop camera
            </>
          ) : (
            <>
              <Camera /> Start camera
            </>
          )}
        </Button>
        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual) check(manual);
          }}
        >
          <label className="sr-only" htmlFor="manual">
            Order number
          </label>
          <input
            id="manual"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            inputMode="numeric"
            placeholder="Order number e.g. 142"
            className="h-14 flex-1 rounded-2xl border-2 border-input bg-background px-4 text-lg outline-none focus:border-ring"
          />
          <Button size="xl" type="submit">
            Check
          </Button>
        </form>
      </section>
      <AnimatePresence mode="wait">
        {result ? (
          <motion.section
            key={result.ok ? result.order.id : result.reason}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className={
              result.ok
                ? "rounded-3xl bg-success p-6 text-success-foreground"
                : "rounded-3xl bg-primary p-6 text-primary-foreground"
            }
            role="status"
          >
            {result.ok ? <CheckCircle2 className="size-16" /> : <XCircle className="size-16" />}
            <p className="mt-3 font-display text-4xl">
              {result.ok ? `Verified – hand over #${result.order.number}` : result.reason}
            </p>
            {result.order && (
              <>
                <p className="mt-2 text-lg">
                  {result.order.customerName} · {result.order.status} ·{" "}
                  {result.order.payment === "online" ? "Paid online" : "Collect payment at counter"}
                </p>
                <ul className="mt-3 space-y-1 text-lg">
                  {result.order.lines.map((l) => (
                    <li key={l.lineId || l.key}>
                      {l.qty}× {l.name}
                      {l.size ? ` (${l.size})` : ""}{" "}
                      <span className="text-sm opacity-80">({l.lineStatus})</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {result.ok && (
              <Button
                size="xl"
                variant="secondary"
                className="mt-6 w-full"
                onClick={async () => {
                  try {
                    const next = await confirmPickup(result.order.id);
                    const leftover = next.lines.filter((l) => l.lineStatus !== "collected");
                    toast.success(
                      leftover.length
                        ? `#${next.number} · ready items handed over, ${leftover.length} still cooking`
                        : `#${next.number} fully handed over`,
                    );
                    setResult(null);
                    setManual("");
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                Hand over ready items
              </Button>
            )}
            {!result.ok && (
              <Button
                size="lg"
                variant="secondary"
                className="mt-6"
                onClick={() => setResult(null)}
              >
                Scan again
              </Button>
            )}
          </motion.section>
        ) : (
          <section className="grid place-items-center rounded-3xl border-2 border-dashed p-10 text-center text-muted-foreground">
            Scan a customer's QR or type their order number.
          </section>
        )}
      </AnimatePresence>
    </div>
  );
}
