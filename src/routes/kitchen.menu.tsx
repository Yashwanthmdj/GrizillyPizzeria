import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Img, VegDot } from "@/components/brand";
import { useKitchenOutletId } from "@/components/staff/StaffShell";
import { useDB } from "@/services/store";
import { deleteMenuItem, upsertMenuItem } from "@/services/api";
import { itemPrice } from "@/services/pricing";
import { CATEGORIES, type MenuItem } from "@/services/types";
import comboImg from "@/assets/menu-combo.jpg";

export const Route = createFileRoute("/kitchen/menu")({ component: KMenu });

const SIZES = [
  { key: "Regular" as const, extra: 0 },
  { key: "Medium" as const, extra: 120 },
  { key: "Large" as const, extra: 240 },
];

function KMenu() {
  const db = useDB();
  const outletId = useKitchenOutletId();
  const [edit, setEdit] = useState<MenuItem | null>(null);
  const [cat, setCat] = useState<string>("All");
  const list = db.menu.filter((m) => cat === "All" || m.category === cat);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">
          Menu · {db.outlets.find((o) => o.id === outletId)?.short}
        </h1>
        <div className="flex flex-wrap gap-1">
          {["All", ...CATEGORIES].map((c) => (
            <Button
              key={c}
              size="sm"
              variant={cat === c ? "default" : "ghost"}
              onClick={() => setCat(c)}
            >
              {c}
            </Button>
          ))}
        </div>
        <Button
          className="ml-auto"
          size="lg"
          onClick={() =>
            setEdit({
              id: `m_${Date.now()}`,
              name: "",
              description: "",
              category: "Pizzas",
              veg: true,
              price: 299,
              image: comboImg,
              availability: { o1: true, o2: true },
              priceOverride: {},
              sizes: SIZES,
              toppings: [],
            })
          }
        >
          <Plus /> Add item
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((m) => {
          const on = !!m.availability[outletId];
          return (
            <div key={m.id} className="flex gap-3 rounded-2xl bg-card p-3 shadow-warm">
              <Img src={m.image} alt="" className={`size-20 rounded-xl ${on ? "" : "grayscale"}`} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  <VegDot veg={m.veg} />
                  <span className="truncate">{m.name}</span>
                </p>
                <p className="text-xs text-muted-foreground">{m.category}</p>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  Rs
                  <input
                    type="number"
                    key={itemPrice(m, outletId)}
                    defaultValue={itemPrice(m, outletId)}
                    aria-label={`Price for ${m.name}`}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v > 0 && v !== itemPrice(m, outletId)) {
                        upsertMenuItem({
                          ...m,
                          priceOverride: { ...m.priceOverride, [outletId]: v },
                        });
                        toast(`${m.name} now Rs ${v} here`);
                      }
                    }}
                    className="h-9 w-24 rounded-lg border-2 border-input bg-background px-2 font-bold"
                  />
                </label>
              </div>
              <div className="flex flex-col items-end justify-between">
                <label className="flex items-center gap-2 text-xs font-semibold">
                  {on ? "Available" : "Sold out"}
                  <Switch
                    checked={on}
                    onCheckedChange={(v) => {
                      upsertMenuItem({ ...m, availability: { ...m.availability, [outletId]: v } });
                      toast(`${m.name} ${v ? "back on" : "marked sold out"}`);
                    }}
                  />
                </label>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${m.name}`}
                    onClick={() => setEdit(m)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${m.name}`}
                    onClick={() => {
                      if (confirm(`Delete ${m.name}?`)) {
                        deleteMenuItem(m.id);
                        toast(`${m.name} deleted`);
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <AnimatePresence>
        {edit && <Editor item={edit} onClose={() => setEdit(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Editor({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const [m, setM] = useState<MenuItem>(item);
  const [tops, setTops] = useState(
    (item.toppings ?? []).map((t) => `${t.name}:${t.price}`).join(", "),
  );
  const input = "mt-1 h-11 w-full rounded-xl border-2 border-input bg-background px-3";
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.form
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        role="dialog"
        aria-label="Edit item"
        onSubmit={(e) => {
          e.preventDefault();
          if (!m.name.trim()) {
            toast.error("Give it a name");
            return;
          }
          const toppings = tops
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => {
              const [n, p] = x.split(":");
              return { name: n!.trim(), price: Number(p) || 40, veg: m.veg };
            });
          upsertMenuItem({
            ...m,
            sizes: m.category === "Pizzas" ? SIZES : undefined,
            toppings: m.category === "Pizzas" ? toppings : undefined,
          });
          toast.success("Menu saved · live on the customer menu");
          onClose();
        }}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-6 shadow-lift"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{item.name ? "Edit item" : "New item"}</h2>
          <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Img src={m.image} alt="" className="size-20 rounded-xl" />
          <label className="text-sm font-semibold">
            Photo (mock upload)
            <input
              type="file"
              accept="image/*"
              className="mt-1 block text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => setM({ ...m, image: String(r.result) });
                r.readAsDataURL(f);
              }}
            />
          </label>
        </div>
        <label className="mt-3 block text-sm font-semibold">
          Name
          <input
            className={input}
            value={m.name}
            onChange={(e) => setM({ ...m, name: e.target.value })}
          />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Description
          <input
            className={input}
            value={m.description}
            onChange={(e) => setM({ ...m, description: e.target.value })}
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold">
            Category
            <select
              className={input}
              value={m.category}
              onChange={(e) => setM({ ...m, category: e.target.value as MenuItem["category"] })}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Base price (Rs)
            <input
              type="number"
              className={input}
              value={m.price}
              onChange={(e) => setM({ ...m, price: Number(e.target.value) })}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <Switch checked={m.veg} onCheckedChange={(v) => setM({ ...m, veg: v })} /> Vegetarian
          </label>
          <label className="text-sm font-semibold">
            Badge{" "}
            <select
              className="ml-1 h-9 rounded-lg border-2 border-input bg-background px-2"
              value={m.badge ?? ""}
              onChange={(e) =>
                setM({ ...m, badge: (e.target.value || undefined) as MenuItem["badge"] })
              }
            >
              <option value="">None</option>
              <option>Bestseller</option>
              <option>Spicy</option>
              <option>New</option>
            </select>
          </label>
        </div>
        {m.category === "Pizzas" && (
          <label className="mt-3 block text-sm font-semibold">
            Toppings (name:price, comma separated)
            <input
              className={input}
              value={tops}
              onChange={(e) => setTops(e.target.value)}
              placeholder="Extra cheese:60, Olives:40"
            />
            <span className="text-xs font-normal text-muted-foreground">
              Sizes: Regular / Medium (+120) / Large (+240)
            </span>
          </label>
        )}
        <Button type="submit" size="lg" className="mt-5 w-full">
          Save item
        </Button>
      </motion.form>
    </motion.div>
  );
}
