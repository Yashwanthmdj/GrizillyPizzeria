import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { StoreGate, fieldCls } from "@/components/admin/ui";
import { updateSettings } from "@/services/api";
import { useDB } from "@/services/store";
import type { ShopSettings } from "@/services/types";

const schema = z.object({
  taxPercent: z.number().min(0).max(28),
  packagingFee: z.number().min(0).max(200),
  minimumOrder: z.number().min(0),
  defaultPrepMinutes: z.number().int().min(5).max(120),
  phone: z.string().min(10),
  whatsapp: z.string().min(10),
  email: z.string().email(),
  refundText: z.string().min(12),
  cancellationText: z.string().min(12),
});

export const Route = createFileRoute("/admin/settings")({
  component: () => (
    <StoreGate>
      <SettingsAdmin />
    </StoreGate>
  ),
});

function SettingsAdmin() {
  const db = useDB();
  const [form, setForm] = useState<ShopSettings>(db.settings);
  const [error, setError] = useState("");
  const set = (patch: Partial<ShopSettings>) => setForm({ ...form, ...patch });

  return (
    <form
      className="mx-auto max-w-2xl space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = schema.safeParse(form);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Check the settings.");
          return;
        }
        setError("");
        await updateSettings(parsed.data);
        toast.success("Settings saved. Cart and checkout use them now.");
      }}
    >
      <h1 className="text-4xl">Settings</h1>
      <p className="text-sm text-muted-foreground">
        Cart, checkout and the contact page read these values.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Num label="GST %" value={form.taxPercent} onChange={(taxPercent) => set({ taxPercent })} />
        <Num
          label="Packaging fee (Rs)"
          value={form.packagingFee}
          onChange={(packagingFee) => set({ packagingFee })}
        />
        <Num
          label="Minimum order (Rs)"
          value={form.minimumOrder}
          onChange={(minimumOrder) => set({ minimumOrder })}
        />
        <Num
          label="Default minutes per order"
          value={form.defaultPrepMinutes}
          onChange={(defaultPrepMinutes) => set({ defaultPrepMinutes })}
        />
      </div>
      <label className="block text-sm font-semibold">
        Phone
        <input
          value={form.phone}
          onChange={(e) => set({ phone: e.target.value })}
          className={`${fieldCls} mt-1`}
        />
      </label>
      <label className="block text-sm font-semibold">
        WhatsApp number
        <input
          value={form.whatsapp}
          onChange={(e) => set({ whatsapp: e.target.value.replace(/\D/g, "") })}
          className={`${fieldCls} mt-1`}
        />
      </label>
      <label className="block text-sm font-semibold">
        Email
        <input
          value={form.email}
          onChange={(e) => set({ email: e.target.value })}
          className={`${fieldCls} mt-1`}
        />
      </label>
      <label className="block text-sm font-semibold">
        Refund text
        <textarea
          value={form.refundText}
          onChange={(e) => set({ refundText: e.target.value })}
          rows={3}
          className={`${fieldCls} mt-1 h-auto py-2`}
        />
      </label>
      <label className="block text-sm font-semibold">
        Cancellation text
        <textarea
          value={form.cancellationText}
          onChange={(e) => set({ cancellationText: e.target.value })}
          rows={3}
          className={`${fieldCls} mt-1 h-auto py-2`}
        />
      </label>
      {error && (
        <p className="text-sm font-semibold text-primary" role="alert">
          {error}
        </p>
      )}
      <Button type="submit">Save settings</Button>
    </form>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${fieldCls} mt-1`}
      />
    </label>
  );
}
