import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Flame, Gift, Lock, Sparkles, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BearMark, CountUp, EASE, Reveal } from "@/components/brand";
import { DeliveryLinks } from "@/components/shop/DeliveryLinks";
import { PageHead, ShopLayout, seo } from "@/components/shop/ShopLayout";
import { useDB, useSession } from "@/services/store";
import { tierFor } from "@/services/pricing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/rewards")({
  head: () =>
    seo(
      "Rewards · Grizzly Pizzeria",
      "Earn points on every Grizzly Pizzeria order and unlock free pizza.",
    ),
  component: Rewards,
});

function OffersBanner() {
  const db = useDB();
  const now = Date.now();
  const live = db.coupons.filter(
    (c) => c.active && c.validFrom <= now && c.validUntil >= now && c.used < c.usageLimit,
  );
  const offerBits =
    live.length > 0
      ? live.map((c) =>
          c.type === "flat"
            ? `${c.code} · Rs ${c.value} off (min Rs ${c.minOrder})`
            : `${c.code} · ${c.value}% off (min Rs ${c.minOrder})`,
        )
      : ["Fresh dough deals drop here", "Points on every order", "Watch this space for outlet offers"];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-secondary/40 bg-gradient-to-r from-primary via-primary-deep to-cocoa px-4 py-3 text-primary-foreground shadow-lift sm:px-5">
      <div className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full bg-secondary/25 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 left-1/3 size-24 rounded-full bg-warning/20 blur-2xl" />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-cocoa">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">Live offers</p>
            <p className="mt-0.5 font-display text-lg leading-tight sm:text-xl">Coupons &amp; deals</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {offerBits.slice(0, 3).map((bit) => (
                <span
                  key={bit}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-foreground/10 px-2.5 py-1 text-xs font-semibold text-primary-foreground/95"
                >
                  <Tag className="size-3 shrink-0 text-secondary" />
                  <span className="max-w-[16rem] truncate sm:max-w-none">{bit}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <Button asChild variant="secondary" className="shrink-0 self-start sm:self-center">
          <Link to="/menu">Use at checkout</Link>
        </Button>
      </div>
    </div>
  );
}

function Rewards() {
  const db = useDB();
  const s = useSession();
  const me = db.customers.find((c) => c.phone === s.phone);
  if (!me)
    return (
      <ShopLayout>
        <PageHead title="Rewards" sub="Points, streaks and free pizza." />
        <div className="mx-auto max-w-md space-y-6 px-4 py-10 text-center sm:px-6">
          <OffersBanner />
          <BearMark className="mx-auto h-32 w-auto" />
          <p className="font-display text-2xl">Place an order to start your wallet.</p>
          <p className="text-muted-foreground">
            We verify your phone at checkout, then points roll in.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/menu">Start an order</Link>
            </Button>
          </div>
          <DeliveryLinks className="justify-center" />
        </div>
      </ShopLayout>
    );
  const { current, next } = tierFor(me.lifetimePoints, db.loyalty);
  const prog = next ? ((me.lifetimePoints - current.min) / (next.min - current.min)) * 100 : 100;
  return (
    <ShopLayout>
      <PageHead title="Rewards" sub={`Hey ${me.name}, here's your stash.`} />
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
        <OffersBanner />

        <motion.div
          initial={{ rotateX: 20, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative overflow-hidden rounded-[2rem] bg-hero grain p-7 text-primary-foreground shadow-lift"
        >
          <BearMark className="absolute -right-4 bottom-0 h-44 w-auto opacity-30" />
          <p className="text-sm font-bold uppercase tracking-widest text-secondary">
            {current.name} tier
          </p>
          <p className="mt-2 font-display text-6xl">
            <CountUp value={me.points} /> <span className="text-2xl">pts</span>
          </p>
          <div className="mt-5 max-w-sm">
            <div className="h-2.5 overflow-hidden rounded-full bg-primary-deep/60">
              <motion.div
                className="h-full rounded-full bg-secondary"
                initial={{ width: 0 }}
                animate={{ width: `${prog}%` }}
                transition={{ duration: 1, ease: EASE }}
              />
            </div>
            <p className="mt-1.5 text-sm text-primary-foreground/80">
              {next
                ? `${next.min - me.lifetimePoints} lifetime pts to ${next.name}`
                : "Top tier. Absolute unit."}
            </p>
          </div>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary-deep/60 px-3 py-1 text-sm font-semibold">
            <Flame className="size-4 text-warning" /> {me.streak}-week visit streak · {me.visits}{" "}
            visits
          </p>
        </motion.div>

        <section>
          <h2 className="text-3xl font-bold">Rewards ladder</h2>
          <p className="text-muted-foreground">
            Earn {db.loyalty.pointsPerHundred} points per Rs 100. Redeem at checkout.
          </p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {db.loyalty.steps.map((r, i) => {
              const ok = me.points >= r.points;
              return (
                <Reveal key={r.id} delay={i * 0.08}>
                  <li
                    className={cn(
                      "h-full rounded-3xl border-2 p-5",
                      ok
                        ? "border-success bg-card shadow-warm"
                        : "border-dashed border-border bg-muted/50",
                    )}
                  >
                    {ok ? (
                      <Gift className="size-7 text-success" />
                    ) : (
                      <Lock className="size-7 text-muted-foreground" />
                    )}
                    <p className="mt-3 font-display text-2xl">{r.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.points} pts · {ok ? "Unlocked!" : `${r.points - me.points} to go`}
                    </p>
                  </li>
                </Reveal>
              );
            })}
          </ol>
        </section>

        <section>
          <h2 className="text-3xl font-bold">Also on delivery</h2>
          <p className="text-muted-foreground">Prefer Zomato or Swiggy? Jump in from here.</p>
          <DeliveryLinks className="mt-4" />
        </section>

        <section>
          <h2 className="text-3xl font-bold">History</h2>
          <ul className="mt-4 divide-y rounded-3xl bg-card shadow-warm">
            {me.history.length === 0 && (
              <li className="p-5 text-muted-foreground">No activity yet.</li>
            )}
            {me.history.map((h, i) => (
              <li key={i} className="flex items-center justify-between p-4">
                <span>
                  <b className="block text-sm">{h.label}</b>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.at).toLocaleDateString("en-IN")}
                  </span>
                </span>
                <span className={cn("font-bold", h.delta > 0 ? "text-success" : "text-primary")}>
                  {h.delta > 0 ? "+" : ""}
                  {h.delta}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ShopLayout>
  );
}
