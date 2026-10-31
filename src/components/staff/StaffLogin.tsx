import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BearMark, EASE, Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { staffLogin } from "@/services/api";

export function StaffLogin({ area }: { area: "kitchen" | "admin" }) {
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const st = await staffLogin(u, p);
      if (area === "admin" && st.role !== "owner") throw new Error("Owner access only");
      toast.success(`Welcome, ${st.name}`);
      nav({ to: area === "kitchen" ? "/kitchen" : "/admin" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-hero grain p-4">
      <motion.form
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="w-full max-w-sm rounded-[2rem] bg-card p-7 shadow-lift"
      >
        <div className="-mx-7 -mt-7 mb-6 flex items-center justify-between rounded-t-[2rem] bg-primary px-7 py-5">
          <Logo className="h-9" />
          <BearMark className="h-12 w-auto" />
        </div>
        <h1 className="text-3xl font-bold">
          {area === "kitchen" ? "Kitchen login" : "Owner login"}
        </h1>
        <p className="text-sm text-muted-foreground">Staff only. Sessions are encrypted.</p>
        <label className="mt-5 block text-sm font-semibold">
          Username
          <input
            value={u}
            onChange={(e) => setU(e.target.value)}
            autoComplete="username"
            className="mt-1.5 h-11 w-full rounded-xl border-2 border-input bg-background px-3 outline-none focus:border-primary"
          />
        </label>
        <div className="mt-3">
          <PasswordField
            value={p}
            onChange={setP}
            autoComplete="current-password"
            inputClassName="bg-background"
          />
        </div>
        <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy || !u || !p}>
          {busy && <Loader2 className="animate-spin" />} Log in
        </Button>
      </motion.form>
    </div>
  );
}
