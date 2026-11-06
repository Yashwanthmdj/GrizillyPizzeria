import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const LOGO = "/brand/logo.png";
const BEAR = "/brand/bear.png";

export const EASE = [0.22, 1, 0.36, 1] as const;
export const INTRO_MS = 3500;

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

export function LoadingScreen({
  fading = false,
  intro = false,
}: {
  fading?: boolean;
  intro?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      animate={{ opacity: fading ? 0 : 1 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="pointer-events-none fixed top-0 left-0 z-[100] flex h-dvh w-dvw items-center justify-center overflow-hidden bg-hero grain"
      role="status"
      aria-label="Loading Grizzly Pizzeria"
    >
      <motion.span
        aria-hidden
        className="absolute size-56 rounded-full bg-secondary/25 blur-2xl sm:size-72"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={reduce ? { scale: 1, opacity: 0.7 } : { scale: [0.7, 1.15, 0.95], opacity: [0, 0.85, 0.55] }}
        transition={reduce ? { duration: 0.4 } : { duration: 2.2, ease: EASE, repeat: Infinity, repeatType: "mirror" }}
      />
      <motion.span
        aria-hidden
        className="absolute size-36 rounded-full border border-secondary/50 sm:size-48"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={reduce ? { scale: 1, opacity: 0.4 } : { scale: [0.55, 1.35], opacity: [0.55, 0] }}
        transition={reduce ? { duration: 0.4 } : { duration: 1.8, ease: EASE, repeat: Infinity }}
      />
      <div className="relative flex max-h-full w-full max-w-sm flex-col items-center gap-5 px-6 sm:gap-7">
        <motion.div
          initial={{ opacity: 0, scale: 0.72, y: 28 }}
          animate={
            reduce
              ? { opacity: 1, scale: 1, y: 0 }
              : { opacity: 1, scale: 1, y: [28, 0, -12, 0] }
          }
          transition={
            reduce
              ? { duration: 0.35, ease: EASE }
              : { duration: 1.15, ease: EASE, times: [0, 0.45, 0.72, 1] }
          }
        >
          <motion.div
            animate={reduce ? { y: 0 } : { y: [0, -8, 0] }}
            transition={
              reduce
                ? { duration: 0.2 }
                : { duration: 1.8, ease: EASE, repeat: Infinity, delay: 1.05 }
            }
          >
            <BearMark className="h-28 w-auto max-h-[26dvh] drop-shadow-xl sm:h-44 sm:max-h-none" />
          </motion.div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0.05 : 0.28, duration: 0.5, ease: EASE }}
          className="flex flex-col items-center gap-3"
        >
          <Logo className="h-10 sm:h-14" />
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary sm:text-xs sm:tracking-[0.28em]">
            100% pure veg
          </p>
        </motion.div>
        {intro && (
          <div className="h-1.5 w-full max-w-44 overflow-hidden rounded-full bg-primary-deep/50">
            <motion.div
              className="h-full rounded-full bg-secondary"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: INTRO_MS / 1000, ease: "linear" }}
            />
          </div>
        )}
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
