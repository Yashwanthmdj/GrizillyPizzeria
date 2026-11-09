import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect } from "react";
import { DeliveryMarks } from "@/components/shop/delivery-marks";
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
        className="absolute size-72 rounded-full bg-secondary/30 blur-3xl sm:size-96"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={reduce ? { scale: 1, opacity: 0.7 } : { scale: [0.75, 1.12, 0.96], opacity: [0, 0.9, 0.6] }}
        transition={reduce ? { duration: 0.4 } : { duration: 2.2, ease: EASE, repeat: Infinity, repeatType: "mirror" }}
      />
      <motion.span
        aria-hidden
        className="absolute size-52 rounded-full border border-secondary/45 sm:size-64"
        initial={{ scale: 0.45, opacity: 0 }}
        animate={reduce ? { scale: 1, opacity: 0.4 } : { scale: [0.6, 1.28], opacity: [0.6, 0] }}
        transition={reduce ? { duration: 0.4 } : { duration: 1.8, ease: EASE, repeat: Infinity }}
      />
      <div className="relative flex max-h-full w-full max-w-[18.5rem] flex-col items-center gap-6 px-6 sm:max-w-sm sm:gap-7">
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
            <BearMark className="h-44 w-auto max-h-[30dvh] drop-shadow-xl sm:h-52 sm:max-h-[34dvh]" />
          </motion.div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0.05 : 0.28, duration: 0.5, ease: EASE }}
          className="flex w-full flex-col items-center gap-3.5"
        >
          <Logo className="h-14 sm:h-16" />
          <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-secondary sm:text-sm sm:tracking-[0.28em]">
            100% pure veg
          </p>
        </motion.div>
        {intro && (
          <>
            <div className="h-2 w-full max-w-56 overflow-hidden rounded-full bg-primary-deep/45">
              <motion.div
                className="h-full rounded-full bg-secondary"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: INTRO_MS / 1000, ease: "linear" }}
              />
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">
                Also open on
              </p>
              <DeliveryMarks />
            </div>
          </>
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
      className={cn("bg-white object-contain", className)}
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
