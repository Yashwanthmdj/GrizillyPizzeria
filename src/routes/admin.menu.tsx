import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { StoreGate, fieldCls } from "@/components/admin/ui";
import { deleteMenuItem, upsertMenuItem } from "@/services/api";
import { inr } from "@/services/pricing";
import { useDB } from "@/services/store";
import { CATEGORIES, type Category, type MenuItem } from "@/services/types";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().min(4),
  category: z.enum(["Pizzas", "Sandwiches", "Garlic Bread", "Fries", "Dips"]),
  price: z.number().positive(),
  badge: z.string().optional(),
});

const FRY_SIZES = [
  { key: "Small" as const, extra: 0 },
  { key: "Medium" as const, extra: 80 },
  { key: "Large" as const, extra: 170 },
];

export const Route = createFileRoute("/admin/menu")({
  component: () => (
    <StoreGate>
      <MenuAdmin />
    </StoreGate>
  ),
});

function blank(outlets: string[]): MenuItem {
  return {
    id: `m_${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    description: "",
    category: "Pizzas",
    veg: true,
    price: 249,
    image: "/brand/bear.png",
    availability: Object.fromEntries(outlets.map((id) => [id, true])),
    priceOverride: {},
    sizes: undefined,
    prepMinutes: 16,
  };
}

function MenuAdmin() {
  const db = useDB();
  const [draft, setDraft] = useState<MenuItem | null>(null);
  const [error, setError] = useState("");

  async function save() {
    if (!draft) return;
    const parsed = schema.safeParse({ ...draft, badge: draft.badge ?? "" });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the item.");
      return;
    }
    setError("");
    const item: MenuItem = {
      ...draft,
      sizes: draft.category === "Fries" ? (draft.sizes ?? FRY_SIZES) : undefined,
      toppings: draft.category === "Fries" ? draft.toppings : undefined,
    };
    await upsertMenuItem(item);
    toast.success(`${item.name} saved`);
    setDraft(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">Menu</h1>
        <Button onClick={() => setDraft(blank(db.outlets.map((o) => o.id)))}>Add item</Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Prices and availability can differ by outlet. Image upload stays on this device.
      </p>
      {db.menu.length === 0 && (
        <p className="mt-6 rounded-3xl border-2 border-dashed p-10 text-center font-display text-2xl">
          The menu is empty.
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {db.menu.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-warm"
          >
            <img src={item.image} alt="" className="size-12 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.category} · {inr(item.price)} · Veg
              </p>
            </div>
            <Button variant="outline" onClick={() => setDraft(structuredClone(item))}>
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await deleteMenuItem(item.id);
                toast(`${item.name} removed`);
              }}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
      {draft && (
        <form
          className="mt-6 grid gap-3 rounded-3xl bg-card p-5 shadow-warm"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <h2 className="text-2xl">
            {db.menu.some((m) => m.id === draft.id) ? "Edit item" : "New item"}
          </h2>
          <input
            aria-label="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className={fieldCls}
            placeholder="Name"
          />
          <textarea
            aria-label="Description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className={`${fieldCls} h-24 py-2`}
            placeholder="Description"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              aria-label="Category"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
              className={fieldCls}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              aria-label="Base price"
              type="number"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
              className={fieldCls}
            />
            <select
              aria-label="Badge"
              value={draft.badge ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, badge: (e.target.value || undefined) as MenuItem["badge"] })
              }
              className={fieldCls}
            >
              <option value="">No badge</option>
              <option>Bestseller</option>
              <option>Spicy</option>
              <option>New</option>
            </select>
          </div>
          <p className="text-sm font-semibold text-muted-foreground">100% vegetarian kitchen — every item is veg.</p>
          <label className="text-sm font-semibold">
            Photo
            <input
              type="file"
              accept="image/*"
              className="mt-1 block text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                // INTEGRATION: replace this data-URL mock with object storage
                const reader = new FileReader();
                reader.onload = () => setDraft({ ...draft, image: String(reader.result) });
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {db.outlets.map((outlet) => (
            <div key={outlet.id} className="grid items-center gap-2 sm:grid-cols-[1fr_160px]">
              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={draft.availability[outlet.id] !== false}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      availability: { ...draft.availability, [outlet.id]: e.target.checked },
                    })
                  }
                />
                Available at {outlet.short}
              </label>
              <input
                aria-label={`${outlet.short} price override`}
                type="number"
                placeholder="Price override"
                value={draft.priceOverride[outlet.id] ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    priceOverride: {
                      ...draft.priceOverride,
                      [outlet.id]: e.target.value ? Number(e.target.value) : undefined,
                    },
                  })
                }
                className={fieldCls}
              />
            </div>
          ))}
          {error && (
            <p className="text-sm font-semibold text-primary" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit">Save item</Button>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
