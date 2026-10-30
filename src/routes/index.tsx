import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Gift, MapPin, QrCode, ShoppingBag, Smile } from "lucide-react";
import { useRef } from "react";
import heroPizza from "@/assets/hero-pizza.webp";
import { Button } from "@/components/ui/button";
import { BearMark, EASE, Reveal } from "@/components/brand";
import { ShopLayout, seo } from "@/components/shop/ShopLayout";
import { MenuCard } from "@/components/shop/MenuCard";
import { OutletCard } from "@/components/shop/OutletCard";
import { useDB, useSession } from "@/services/store";
import { selectOutlet } from "@/services/api";

export const Route = createFileRoute("/")({
  head: () =>
    seo(
      "Grizzly Pizzeria · Big slices. Bigger bite.",
      "Order hand-stretched pizza for pickup from either Grizzly Pizzeria outlet. Skip the queue, earn points, show your QR.",
    ),
  component: Home,
});

const HEADLINE = ["Big", "slices.", "Bigger", "bite."];
const TOPPINGS = ["🌿", "🍅", "🧀", "🌶️", "🍄", "🫒"];
const POINTS = [
  "Hand-stretched daily",
  "Wood-fired flavour",
  "Skip the queue",
  "Earn points every bite",
  "Two outlets",
  "Veg & non-veg",
];

function Home() {
  const db = useDB();
  const s = useSession();
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const favourites = db.menu.filter((m) => m.badge === "Bestseller");

  return (
    <ShopLayout>
      <section ref={ref} className="relative overflow-hidden bg-hero grain text-primary-foreground">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-2 md:pb-24 md:pt-20">
          <motion.div style={{ y: y2 }} className="relative z-10">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="inline-flex items-center gap-2 rounded-full bg-primary-deep/60 px-3 py-1 text-sm font-semibold text-secondary"
            >
              <BearMark className="h-5 w-auto" /> Pickup in ~
              {Math.min(...db.outlets.map((o) => o.waitMinutes))} min
            </motion.p>
            <h1 className="mt-4 text-6xl font-bold leading-[0.95] sm:text-7xl lg:text-8xl">
              {HEADLINE.map((w, i) => (
                <motion.span
                  key={i}
                  className="mr-4 inline-block"
                  initial={{ opacity: 0, y: 40, rotate: -4 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ delay: 1.1 + i * 0.12, duration: 0.6, ease: EASE }}
                >
                  <span className={i >= 2 ? "text-secondary" : ""}>{w}</span>
                </motion.span>
              ))}
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.7, ease: EASE }}
              className="mt-5 max-w-md text-lg text-primary-foreground/85"
            >
              Order ahead, flash your QR at the counter, walk out with a box of joy. No queue. No
              drama.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.85, ease: EASE }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Button
                variant="hero"
                size="lg"
                onClick={() => nav({ to: s.outletId ? "/menu" : "/outlets" })}
              >
                Order now <ArrowRight />
              </Button>
              <Button variant="heroOutline" size="lg" asChild>
                <Link to="/outlets">
                  <MapPin />{" "}
                  {s.outletId
                    ? db.outlets.find((o) => o.id === s.outletId)?.short
                    : "Choose outlet"}
                </Link>
              </Button>
            </motion.div>
          </motion.div>
          <motion.div
            style={{ y: y1 }}
            className="relative mx-auto aspect-square w-full max-w-[520px]"
          >
            <div className="absolute inset-[8%] rounded-full bg-primary-deep/50 blur-2xl" />
            <motion.img
              src={heroPizza}
              alt="Pepperoni and basil pizza"
              width={720}
              height={720}
              fetchPriority="high"
              className="relative size-full drop-shadow-2xl"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={reduce ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1, rotate: 360 }}
              transition={{
                scale: { duration: 0.9, ease: EASE, delay: 1 },
                opacity: { duration: 0.6, delay: 1 },
                rotate: { duration: 60, repeat: Infinity, ease: "linear" },
              }}
            />
            {!reduce &&
              TOPPINGS.map((t, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="absolute text-3xl sm:text-4xl"
                  style={{
                    left: `${[2, 85, 8, 90, 45, 70][i]}%`,
                    top: `${[10, 15, 75, 70, -2, 92][i]}%`,
                  }}
                  animate={{ y: [0, -14, 0], rotate: [0, 12, 0] }}
                  transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  {t}
                </motion.span>
              ))}
          </motion.div>
        </div>
      </section>

      <div
        className="overflow-hidden border-y-4 border-primary-deep bg-secondary py-3 text-primary-deep"
        aria-hidden
      >
        <div className="marquee flex w-max gap-10 whitespace-nowrap font-display text-xl font-semibold">
          {[...POINTS, ...POINTS].map((p, i) => (
            <span key={i} className="flex items-center gap-10">
              {p} <span className="text-primary">✦</span>
            </span>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Reveal className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-primary">
              Crowd favourites
            </p>
            <h2 className="text-4xl font-bold sm:text-5xl">The bear's best</h2>
          </div>
          <Link
            to="/menu"
            className="hidden items-center gap-1 font-semibold text-primary hover:underline sm:flex"
          >
            Full menu <ArrowRight className="size-4" />
          </Link>
        </Reveal>
        <div className="no-scrollbar -mx-4 mt-8 flex snap-x gap-5 overflow-x-auto px-4 pb-4">
          {favourites.map((m, i) => (
            <div key={m.id} className="w-72 shrink-0 snap-start">
              <MenuCard item={m} outletId={s.outletId} index={i} />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <h2 className="text-center text-4xl font-bold sm:text-5xl">How it works</h2>
          </Reveal>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: MapPin, t: "Choose outlet", d: "Pick the den nearest you." },
              { icon: ShoppingBag, t: "Order", d: "Build your box, pay online or at the counter." },
              {
                icon: QrCode,
                t: "Show your QR",
                d: "Flash it at pickup. Single use, super quick.",
              },
              { icon: Smile, t: "Enjoy", d: "Eat. Earn points. Repeat." },
            ].map((x, i) => (
              <Reveal key={x.t} delay={i * 0.1}>
                <li className="relative h-full rounded-3xl bg-card p-6 shadow-warm">
                  <span className="absolute right-5 top-4 font-display text-5xl text-muted">
                    {i + 1}
                  </span>
                  <motion.span
                    whileHover={{ rotate: -10, scale: 1.1 }}
                    className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground"
                  >
                    <x.icon className="size-6" />
                  </motion.span>
                  <h3 className="mt-4 text-xl font-bold">{x.t}</h3>
                  <p className="mt-1 text-muted-foreground">{x.d}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-cocoa p-8 text-cream shadow-lift sm:p-12">
            <BearMark className="absolute -bottom-6 right-4 h-48 w-auto opacity-25 sm:h-64" />
            <Gift className="size-10 text-secondary" />
            <h2 className="mt-4 max-w-lg text-4xl font-bold sm:text-5xl">
              Every bite earns points.
            </h2>
            <p className="mt-3 max-w-md text-cream/75">
              {db.loyalty.pointsPerHundred} points per Rs 100. Hit {db.loyalty.steps.at(-1)?.points}{" "}
              and the next {db.loyalty.steps.at(-1)?.label.toLowerCase()} is on us.
            </p>
            <Button variant="hero" className="mt-6" asChild>
              <Link to="/rewards">See my rewards</Link>
            </Button>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <Reveal>
          <h2 className="text-4xl font-bold sm:text-5xl">Find a den</h2>
        </Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {db.outlets.map((o, i) => (
            <Reveal key={o.id} delay={i * 0.1}>
              <OutletCard
                outlet={o}
                orders={db.orders}
                selected={s.outletId === o.id}
                onSelect={() => {
                  selectOutlet(o.id);
                  nav({ to: "/menu" });
                }}
              />
            </Reveal>
          ))}
        </div>
      </section>
    </ShopLayout>
  );
}
