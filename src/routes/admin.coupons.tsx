import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { StoreGate, fieldCls } from "@/components/admin/ui";
import { deleteCoupon, saveCoupon } from "@/services/api";
import { useDB } from "@/services/store";
import type { Coupon } from "@/services/types";

const schema = z
  .object({
    code: z.string().min(3).max(16),
    type: z.enum(["percent", "flat"]),
    value: z.number().positive(),
    minOrder: z.number().min(0),
    validFrom: z.number(),
    validUntil: z.number(),
    usageLimit: z.number().int().positive(),
    active: z.boolean(),
  })
  .refine((c) => c.validUntil > c.validFrom, { message: "End date must be after the start date." })
  .refine((c) => (c.type === "percent" ? c.value <= 90 : true), {
    message: "Percent coupons stay at 90% or less.",
  });

function blank(): Coupon {
  const now = Date.now();
  return {
    id: `cp_${Math.random().toString(36).slice(2, 8)}`,
    code: "",
    type: "flat",
    value: 50,
    minOrder: 299,
    validFrom: now,
    validUntil: now + 30 * 864e5,
    usageLimit: 50,
    used: 0,
    active: true,
  };
}

const day = (ts: number) => new Date(ts).toISOString().slice(0, 10);

export const Route = createFileRoute("/admin/coupons")({
  component: () => (
    <StoreGate>
      <CouponsAdmin />
    </StoreGate>
  ),
});

function CouponsAdmin() {
  const db = useDB();
  const [draft, setDraft] = useState<Coupon | null>(null);
  const [error, setError] = useState("");

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl">Coupons</h1>
        <Button onClick={() => setDraft(blank())}>Add coupon</Button>
      </div>
      {db.coupons.length === 0 && (
        <p className="mt-6 rounded-3xl border-2 border-dashed p-10 text-center font-display text-2xl">
          No coupons yet.
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {db.coupons.map((coupon) => (
          <li
            key={coupon.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-warm"
          >
            <div className="flex-1">
              <p className="font-semibold">
                {coupon.code} ·{" "}
                {coupon.type === "percent" ? `${coupon.value}%` : `Rs ${coupon.value}`}
              </p>
              <p className="text-xs text-muted-foreground">
                Min Rs {coupon.minOrder} · {coupon.used}/{coupon.usageLimit} used ·{" "}
                {coupon.active ? "Active" : "Off"}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                saveCoupon({ ...coupon, active: !coupon.active }).then(() =>
                  toast(coupon.active ? "Turned off" : "Turned on"),
                )
              }
            >
              {coupon.active ? "Turn off" : "Turn on"}
            </Button>
            <Button variant="outline" onClick={() => setDraft(coupon)}>
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteCoupon(coupon.id).then(() => toast("Coupon removed"))}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
      {draft && (
        <form
          className="mt-6 grid gap-3 rounded-3xl bg-card p-5 shadow-warm sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const parsed = schema.safeParse({ ...draft, code: draft.code.trim().toUpperCase() });
            if (!parsed.success) {
              setError(parsed.error.issues[0]?.message ?? "Check the coupon.");
              return;
            }
            setError("");
            await saveCoupon({ ...draft, ...parsed.data });
            toast.success("Coupon saved");
            setDraft(null);
          }}
        >
          <label className="text-sm font-semibold sm:col-span-2">
            Code
            <input
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
              className={`${fieldCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Type
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as Coupon["type"] })}
              className={`${fieldCls} mt-1`}
            >
              <option value="percent">Percent</option>
              <option value="flat">Flat Rs</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Value
            <input
              type="number"
              value={draft.value}
              onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) })}
              className={`${fieldCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Minimum order
            <input
              type="number"
              value={draft.minOrder}
              onChange={(e) => setDraft({ ...draft, minOrder: Number(e.target.value) })}
              className={`${fieldCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Usage limit
            <input
              type="number"
              value={draft.usageLimit}
              onChange={(e) => setDraft({ ...draft, usageLimit: Number(e.target.value) })}
              className={`${fieldCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Valid from
            <input
              type="date"
              value={day(draft.validFrom)}
              onChange={(e) =>
                setDraft({ ...draft, validFrom: new Date(e.target.value).getTime() })
              }
              className={`${fieldCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Valid until
            <input
              type="date"
              value={day(draft.validUntil)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  validUntil: new Date(e.target.value).setHours(23, 59, 59, 999),
                })
              }
              className={`${fieldCls} mt-1`}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />{" "}
            Active
          </label>
          {error && (
            <p className="text-sm font-semibold text-primary sm:col-span-2" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit">Save coupon</Button>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
