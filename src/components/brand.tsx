import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const LOGO = "/brand/logo.png";
const BEAR = "/brand/bear.png";

export const EASE = [0.22, 1, 0.36, 1] as const;

export function Logo({ className, onRed = true }: { className?: string; onRed?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xl",
        !onRed && "bg-primary px-3 py-1.5",
        className,
      )}
    >
      <img
        src={LOGO}
        alt="Grizzly Pizzeria"
        width={1682}
        height={475}
        className="h-full w-auto object-contain"
      />
    </span>
  );
}

export function BearMark({ className }: { className?: string }) {
  return (
    <img
      src={BEAR}
      alt=""
      aria-hidden
      width={341}
      height={457}
      className={cn("object-contain", className)}
    />
  );
}

export function LoadingScreen() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      className="pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-hero grain"
      role="status"
      aria-label="Loading Grizzly Pizzeria"
    >
      <div className="flex flex-col items-center gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: [20, 0, -14, 0] }}
          transition={{ duration: 1.2, ease: EASE, times: [0, 0.4, 0.7, 1] }}
        >
          <BearMark className="h-36 w-auto drop-shadow-xl" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Logo className="h-12" />
        </motion.div>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-primary-deep/60">
          <motion.div
            className="h-full rounded-full bg-secondary"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1, ease: EASE }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function VegDot({ veg = true }: { veg?: boolean }) {
  return (
    <span
      className="inline-grid size-4 shrink-0 place-items-center rounded-[4px] border-2 border-success"
      title="Vegetarian"
    >
      <span className="size-1.5 rounded-full bg-success" />
      <span className="sr-only">{veg ? "Vegetarian" : "Vegetarian kitchen"}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-muted", className)} />;
}

export function Img({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      width={640}
      height={477}
      className={cn("bg-muted object-cover", className)}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = BEAR;
        (e.currentTarget as HTMLImageElement).classList.add("object-contain", "p-6");
      }}
    />
  );
}

export function CountUp({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(0);
  const txt = useTransform(mv, (v) => Math.round(v).toLocaleString("en-IN"));
  useEffect(() => {
    const c = animate(mv, value, { duration: 1.2, ease: EASE });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={className}>{txt}</motion.span>;
}
