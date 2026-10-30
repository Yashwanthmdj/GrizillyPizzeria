import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/brand";
import { ready } from "@/services/api";

export const fieldCls =
  "h-11 w-full rounded-xl border-2 border-input bg-background px-3 text-sm outline-none focus:border-primary";

export function AdminLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label={label}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}

export function AdminError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl bg-card p-10 text-center shadow-warm" role="alert">
      <p className="font-display text-2xl">Couldn't load this</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
      <Button className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function AdminEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border-2 border-dashed p-10 text-center">
      <p className="font-display text-2xl">{title}</p>
      <p className="mt-1 text-muted-foreground">{body}</p>
    </div>
  );
}

export function useStoreGate() {
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [message, setMessage] = useState("The demo store didn't respond.");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setStatus("loading");
    ready()
      .then(() => {
        if (live) setStatus("ready");
      })
      .catch((error: Error) => {
        if (!live) return;
        setMessage(error.message);
        setStatus("error");
      });
    return () => {
      live = false;
    };
  }, [tick]);
  return { status, message, retry: () => setTick((n) => n + 1) };
}

export function StoreGate({ children }: { children: ReactNode }) {
  const gate = useStoreGate();
  if (gate.status === "loading") return <AdminLoading />;
  if (gate.status === "error") return <AdminError message={gate.message} onRetry={gate.retry} />;
  return children;
}
