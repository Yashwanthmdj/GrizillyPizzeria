import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function SyncBadge({ tick }: { tick: string }) {
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    setSyncing(true);
    const timer = setTimeout(() => setSyncing(false), 450);
    return () => clearTimeout(timer);
  }, [tick]);
  return (
    <span
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-muted px-3 text-xs font-semibold"
      role="status"
    >
      <span
        className={cn("size-2 rounded-full", syncing ? "animate-pulse bg-warning" : "bg-success")}
      />
      {syncing ? "Syncing" : "Live"}
    </span>
  );
}
