import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { StoreGate, fieldCls } from "@/components/admin/ui";
import { updateLoyalty } from "@/services/api";
import { useDB } from "@/services/store";
import type { LoyaltyRule, RewardStep } from "@/services/types";

const schema = z.object({
  pointsPerHundred: z.number().int().min(1).max(100),
  steps: z
    .array(
      z.object({
        id: z.string().min(1),
        points: z.number().int().positive(),
        label: z.string().min(2),
        type: z.enum(["discount", "free-pizza"]),
        value: z.number().positive(),
      }),
    )
    .min(1),
  tiers: z.array(z.object({ name: z.string().min(1), min: z.number().int().min(0) })).min(1),
});

export const Route = createFileRoute("/admin/loyalty")({
  component: () => (
    <StoreGate>
      <LoyaltyAdmin />
    </StoreGate>
  ),
});

function LoyaltyAdmin() {
  const db = useDB();
  const [rule, setRule] = useState<LoyaltyRule>(db.loyalty);
  const [error, setError] = useState("");

  function patchStep(id: string, patch: Partial<RewardStep>) {
    setRule((current) => ({
      ...current,
      steps: current.steps.map((step) => (step.id === id ? { ...step, ...patch } : step)),
    }));
  }

  async function save() {
    const parsed = schema.safeParse(rule);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the loyalty form.");
      return;
    }
    setError("");
    await updateLoyalty(parsed.data);
    toast.success("Loyalty rules saved");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div>
        <h1 className="text-4xl">Loyalty</h1>
        <label className="mt-4 block text-sm font-semibold">
          Points per Rs 100
          <input
            type="number"
            min={1}
            max={100}
            value={rule.pointsPerHundred}
            onChange={(e) => setRule({ ...rule, pointsPerHundred: Number(e.target.value) })}
            className={`${fieldCls} mt-1`}
          />
        </label>
        <h2 className="mt-6 text-2xl">Reward steps</h2>
        <div className="mt-3 space-y-3">
          {rule.steps.map((step) => (
            <div key={step.id} className="grid gap-2 rounded-2xl bg-card p-3 sm:grid-cols-5">
              <input
                aria-label="Label"
                value={step.label}
                onChange={(e) => patchStep(step.id, { label: e.target.value })}
                className={fieldCls}
              />
              <input
                aria-label="Points"
                type="number"
                value={step.points}
                onChange={(e) => patchStep(step.id, { points: Number(e.target.value) })}
                className={fieldCls}
              />
              <select
                aria-label="Type"
                value={step.type}
                onChange={(e) => patchStep(step.id, { type: e.target.value as RewardStep["type"] })}
                className={fieldCls}
              >
                <option value="discount">Discount</option>
                <option value="free-pizza">Free pizza</option>
              </select>
              <input
                aria-label="Value in Rs"
                type="number"
                value={step.value}
                onChange={(e) => patchStep(step.id, { value: Number(e.target.value) })}
                className={fieldCls}
              />
              <Button
                variant="outline"
                onClick={() =>
                  setRule({ ...rule, steps: rule.steps.filter((s) => s.id !== step.id) })
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() =>
              setRule({
                ...rule,
                steps: [
                  ...rule.steps,
                  {
                    id: `r_${Date.now()}`,
                    points: 100,
                    label: "New reward",
                    type: "discount",
                    value: 50,
                  },
                ],
              })
            }
          >
            Add step
          </Button>
        </div>
        <h2 className="mt-6 text-2xl">Tiers</h2>
        <div className="mt-3 space-y-2">
          {rule.tiers.map((tier, index) => (
            <div key={`${tier.name}-${index}`} className="grid grid-cols-[1fr_120px_auto] gap-2">
              <input
                aria-label="Tier name"
                value={tier.name}
                onChange={(e) =>
                  setRule({
                    ...rule,
                    tiers: rule.tiers.map((t, i) =>
                      i === index ? { ...t, name: e.target.value } : t,
                    ),
                  })
                }
                className={fieldCls}
              />
              <input
                aria-label="Tier minimum"
                type="number"
                value={tier.min}
                onChange={(e) =>
                  setRule({
                    ...rule,
                    tiers: rule.tiers.map((t, i) =>
                      i === index ? { ...t, min: Number(e.target.value) } : t,
                    ),
                  })
                }
                className={fieldCls}
              />
              <Button
                variant="outline"
                onClick={() =>
                  setRule({ ...rule, tiers: rule.tiers.filter((_, i) => i !== index) })
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() =>
              setRule({ ...rule, tiers: [...rule.tiers, { name: "New tier", min: 0 }] })
            }
          >
            Add tier
          </Button>
        </div>
        {error && (
          <p className="mt-3 text-sm font-semibold text-primary" role="alert">
            {error}
          </p>
        )}
        <Button className="mt-4" onClick={save}>
          Save loyalty
        </Button>
      </div>
      <aside className="h-fit rounded-3xl bg-hero p-6 text-primary-foreground">
        <p className="text-xs font-bold uppercase tracking-widest text-secondary">
          What the customer sees
        </p>
        <p className="mt-3 text-4xl">{rule.pointsPerHundred} pts</p>
        <p className="text-sm text-primary-foreground/80">for every Rs 100 spent</p>
        <ul className="mt-4 space-y-2">
          {rule.steps.map((step) => (
            <li key={step.id} className="rounded-2xl bg-primary-deep/50 px-3 py-2 text-sm">
              {step.points} pts · {step.label} · Rs {step.value}
            </li>
          ))}
        </ul>
        <ul className="mt-4 space-y-1 text-sm">
          {rule.tiers.map((tier) => (
            <li key={tier.name}>
              {tier.name} from {tier.min} lifetime pts
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
