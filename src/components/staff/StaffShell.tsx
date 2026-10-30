import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Logo, EASE } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useDB, useSession, setSession } from "@/services/store";
import { staffLogout } from "@/services/api";
import type { Role } from "@/services/types";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string };

/** Route guard + chrome for kitchen (dark) and admin (light) areas. */
export function StaffShell({
  area,
  nav,
  children,
}: {
  area: "kitchen" | "admin";
  nav: NavItem[];
  children: ReactNode;
}) {
  const s = useSession();
  const db = useDB();
  const navigate = useNavigate();
  const kOutlet = useKitchenOutletId();
  const allowed: Role[] = area === "kitchen" ? ["kitchen", "owner"] : ["owner"];
  if (!s.staff || !allowed.includes(s.staff.role))
    return <Navigate to={area === "kitchen" ? "/kitchen/login" : "/admin/login"} />;
  const dark = area === "kitchen";
  return (
    <div className={cn("min-h-screen bg-background text-foreground", dark && "kitchen-theme")}>
      <header
        className={cn(
          "sticky top-0 z-40 border-b",
          dark ? "bg-card" : "bg-primary text-primary-foreground",
        )}
      >
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="h-9">
            <Logo className={cn("h-full", dark && "rounded-lg bg-primary px-2 py-1")} />
          </Link>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary-deep">
            {area === "kitchen" ? "Kitchen" : "Owner"}
          </span>
          <nav className="flex flex-wrap gap-1" aria-label={`${area} navigation`}>
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: true }}
                className="rounded-full px-4 py-2.5 text-sm font-semibold opacity-80 transition hover:opacity-100"
                activeProps={{
                  className: cn(
                    "!opacity-100",
                    dark ? "bg-accent text-accent-foreground" : "bg-primary-deep text-secondary",
                  ),
                }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {area === "kitchen" && s.staff.role === "owner" && (
              <select
                value={kOutlet}
                onChange={(e) => setSession((x) => ({ ...x, kitchenOutlet: e.target.value }))}
                aria-label="Kitchen outlet"
                className="h-11 rounded-full border-2 border-input bg-background px-3 text-sm font-semibold"
              >
                {db.outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.short}
                  </option>
                ))}
              </select>
            )}
            {area === "kitchen" && s.staff.role === "kitchen" && (
              <span className="text-sm font-semibold">
                {db.outlets.find((o) => o.id === kOutlet)?.short}
              </span>
            )}
            <Button
              variant={dark ? "outline" : "secondary"}
              size="sm"
              onClick={() => {
                staffLogout();
                navigate({ to: "/" });
              }}
            >
              <LogOut /> Log out
            </Button>
          </div>
        </div>
      </header>
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="mx-auto max-w-[1600px] px-4 py-6"
      >
        {children}
      </motion.main>
    </div>
  );
}

export function useKitchenOutletId() {
  const s = useSession();
  if (s.staff?.role === "kitchen") return s.staff.outletId ?? "o1";
  return s.kitchenOutlet ?? "o1";
}
