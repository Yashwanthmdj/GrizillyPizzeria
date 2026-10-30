import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { CountUp, Skeleton } from "@/components/brand";
import { AdminError } from "@/components/admin/ui";
import { getAnalytics } from "@/services/api";
import type { Analytics, Period } from "@/services/analytics";
import { inr } from "@/services/pricing";
import { cn } from "@/lib/utils";

const InsightCharts = lazy(() => import("@/components/admin/InsightCharts"));

export const Route = createFileRoute("/admin/")({
  component: Insights,
});

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

function Insights() {
  const [outletId, setOutletId] = useState<string | "all">("all");
  const [period, setPeriod] = useState<Period>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Analytics | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setStatus("loading");
    const range =
      from && to
        ? { from: new Date(from).setHours(0, 0, 0, 0), to: new Date(to).setHours(23, 59, 59, 999) }
        : undefined;
    getAnalytics(outletId, period, range)
      .then((next) => {
        if (!live) return;
        setData(next);
        setStatus("ready");
      })
      .catch((error: Error) => {
        if (!live) return;
        setMessage(error.message);
        setStatus("error");
      });
    return () => {
      live = false;
    };
  }, [outletId, period, from, to, tick]);

  function exportCsv() {
    if (!data) return;
    const csv = data.exportRows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `grizzly-${period}${data.sample ? "-SAMPLE" : ""}.csv`;
    a.click();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">Insights</h1>
          <p className="text-sm text-muted-foreground">
            Both Madhapur outlets. Payments here are demo figures.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!data}
          className="h-11 rounded-full bg-secondary px-4 text-sm font-semibold text-secondary-foreground disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          ["all", "All"],
          ["o1", "Outlet 1"],
          ["o2", "Outlet 2"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={outletId === id}
            onClick={() => setOutletId(id as "all")}
            className={cn(
              "h-11 rounded-full px-4 text-sm font-semibold",
              outletId === id ? "bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2" role="tablist" aria-label="Period">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={period === item.id && !(from && to)}
              onClick={() => {
                setPeriod(item.id);
                setFrom("");
                setTo("");
              }}
              className={cn(
                "h-11 rounded-full px-4 text-sm font-semibold",
                period === item.id && !(from && to) ? "bg-cocoa text-cream" : "bg-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block h-11 rounded-xl border-2 border-input bg-card px-3"
          />
        </label>
        <label className="text-sm font-semibold">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block h-11 rounded-xl border-2 border-input bg-card px-3"
          />
        </label>
        <Link
          to="/admin/orders"
          className="h-11 rounded-full px-4 py-2.5 text-sm font-semibold text-primary underline"
        >
          Open the order list
        </Link>
      </div>
      {data?.notice && (
        <p className="rounded-2xl bg-warning/40 px-4 py-3 text-sm font-semibold" role="status">
          {data.notice}
        </p>
      )}
      {status === "loading" && !data && (
        <div className="grid gap-4 sm:grid-cols-4" aria-busy="true" aria-label="Loading insights">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}
      {status === "error" && <AdminError message={message} onRetry={() => setTick((n) => n + 1)} />}
      {data && status !== "error" && data.orders === 0 && !data.sample && (
        <p className="rounded-3xl border-2 border-dashed p-10 text-center font-display text-2xl">
          No orders in this range.
        </p>
      )}
      {data && (data.orders > 0 || data.sample) && status !== "error" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Revenue" value={inr(data.revenue)} n={data.revenue} />
            <Kpi label="Orders" value={String(data.orders)} n={data.orders} />
            <Kpi label="Completed" value={String(data.completed)} n={data.completed} />
            <Kpi label="Rejected / cancelled" value={String(data.rejected)} n={data.rejected} />
            <Kpi
              label="Pending payments"
              value={String(data.pendingPayments)}
              n={data.pendingPayments}
            />
            <Kpi
              label="Average order"
              value={inr(data.averageOrderValue)}
              n={data.averageOrderValue}
            />
            <Kpi label="New vs repeat" value={`${data.newCustomers} / ${data.repeatCustomers}`} />
            <Kpi label="Online vs counter" value={`${data.online} / ${data.counter}`} />
          </div>
          <Suspense fallback={<Skeleton className="h-72" />}>
            <InsightCharts data={data} />
          </Suspense>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, n }: { label: string; value: string; n?: number }) {
  return (
    <article className="rounded-3xl bg-card p-4 shadow-warm">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl text-primary">
        {n != null ? <CountUp value={n} /> : value}
      </p>
      {n != null && label !== "Revenue" && label !== "Average order" ? null : n != null ? (
        <p className="text-xs text-muted-foreground">{value}</p>
      ) : null}
    </article>
  );
}
