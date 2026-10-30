import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Confetti() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const colors = ["bg-primary", "bg-secondary", "bg-warning", "bg-success", "bg-primary-deep"];
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {Array.from({ length: 60 }).map((_, i) => (
        <motion.span
          key={i}
          className={cn("absolute top-0 h-3 w-2 rounded-sm", colors[i % colors.length])}
          style={{ left: `${(i * 37) % 100}%` }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", rotate: 720, opacity: [1, 1, 0] }}
          transition={{ duration: 2.4 + (i % 5) * 0.3, delay: (i % 10) * 0.05, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
