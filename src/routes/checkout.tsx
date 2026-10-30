import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CreditCard, Landmark, Loader2, Smartphone, Store, Wallet, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EASE } from "@/components/brand";
import { ShopLayout, seo } from "@/components/shop/ShopLayout";
import { BillLines, Row } from "@/components/shop/Bill";
import { useDB, useSession } from "@/services/store";
import {
  applyCoupon,
  clearCoupon,
  placeOrder,
  selectOutlet,
  sendOtp,
  setRedeem,
  verifyOtp,
} from "@/services/api";
import { billOptions, cartSubtotal, computeBill, inr, validateCoupon } from "@/services/pricing";
import { canOrder } from "@/services/outlet-status";
import type { PaymentMethod } from "@/services/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () =>
    seo(
      "Checkout · Grizzly Pizzeria",
      "Choose pickup time, verify your phone and pay for your Grizzly Pizzeria order.",
    ),
  component: Checkout,
});

const STEPS = ["Pickup", "Details", "Payment"];

function slots() {
  const out: number[] = [];
  const d = new Date();
  d.setMinutes(Math.ceil((d.getMinutes() + 45) / 15) * 15, 0, 0);
  for (let i = 0; i < 8; i++) out.push(d.getTime() + i * 15 * 6e4);
  return out;
}
const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

function Checkout() {
  const db = useDB();
  const s = useSession();
  const nav = useNavigate();
  const me = db.customers.find((c) => c.phone === s.phone);
  const [step, setStep] = useState(0);
  const [when, setWhen] = useState<"asap" | number>("asap");
  const [name, setName] = useState(me?.name ?? "");
  const [phone, setPhone] = useState(s.phone ?? "");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("online");
  const [payOpen, setPayOpen] = useState(false);
  const timeSlots = useMemo(slots, []);
  const outlet = db.outlets.find((o) => o.id === s.outletId);
  const reward = db.loyalty.steps.find((x) => x.id === s.redeemStepId) ?? null;
  const subtotal = cartSubtotal(s.cart);
  const found = db.coupons.find((c) => c.code === s.couponCode) ?? null;
  const couponCheck = found ? validateCoupon(found, subtotal, Date.now()) : null;
  const coupon = found && couponCheck?.ok ? found : null;
  const bill = computeBill(s.cart, db.loyalty, reward, billOptions(db.settings, coupon));
  const [couponCode, setCouponCode] = useState(s.couponCode ?? "");
  const short = Math.max(0, db.settings.minimumOrder - subtotal);

  if (!s.cart.length)
    return (
      <ShopLayout>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-4xl font-bold">Nothing to check out</h1>
          <p className="mt-2 text-muted-foreground">Your box is empty. The bear is hungry.</p>
          <Button asChild className="mt-6">
            <Link to="/menu">Browse menu</Link>
          </Button>
        </div>
      </ShopLayout>
    );

  async function finish(method: PaymentMethod) {
    setBusy(true);
    try {
      const o = await placeOrder({
        payment: method,
        name,
        notes: notes || undefined,
        scheduledFor: when === "asap" ? undefined : when,
      });
      toast.success(`Order #${o.number} placed!`);
      nav({ to: "/order/$id", params: { id: o.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setPayOpen(false);
    }
  }

  const verified = !!s.phone && s.phone === phone;

  return (
    <ShopLayout>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-4xl font-bold sm:text-5xl">Checkout</h1>
        <div className="mt-6" aria-label={`Step ${step + 1} of 3`}>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              animate={{ width: `${((step + 1) / 3) * 100}%` }}
              transition={{ ease: EASE, duration: 0.5 }}
            />
          </div>
          <ol className="mt-2 flex justify-between text-sm font-semibold">
            {STEPS.map((x, i) => (
              <li key={x} className={i <= step ? "text-primary" : "text-muted-foreground"}>
                {i + 1}. {x}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_340px]">
          <div className="rounded-3xl bg-card p-5 shadow-warm sm:p-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                {step === 0 && (
                  <div className="space-y-6">
                    <section>
                      <h2 className="text-2xl font-bold">Which outlet?</h2>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {db.outlets.map((o) => (
                          <button
                            key={o.id}
                            disabled={!canOrder(o)}
                            onClick={() => selectOutlet(o.id)}
                            aria-pressed={s.outletId === o.id}
                            className={cn(
                              "rounded-2xl border-2 p-4 text-left transition disabled:opacity-50",
                              s.outletId === o.id
                                ? "border-primary bg-accent"
                                : "border-border hover:border-primary/40",
                            )}
                          >
                            <p className="font-semibold">{o.short}</p>
                            <p className="text-xs text-muted-foreground">
                              {canOrder(o)
                                ? `~${o.waitMinutes} min wait`
                                : o.pauseOrders
                                  ? "Orders paused"
                                  : "Closed now"}
                            </p>
                          </button>
                        ))}
                      </div>
                    </section>
                    <section>
                      <h2 className="text-2xl font-bold">When?</h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Chip on={when === "asap"} onClick={() => setWhen("asap")}>
                          ASAP · ~{outlet?.waitMinutes || db.settings.defaultPrepMinutes} min
                        </Chip>
                        {timeSlots.map((t) => (
                          <Chip key={t} on={when === t} onClick={() => setWhen(t)}>
                            {fmtTime(t)}
                          </Chip>
                        ))}
                      </div>
                    </section>
                    <Button
                      size="lg"
                      disabled={!outlet || !canOrder(outlet)}
                      onClick={() => setStep(1)}
                    >
                      Continue
                    </Button>
                  </div>
                )}
                {step === 1 && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold">Who's picking up?</h2>
                    <Field label="Name">
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inputCls}
                        autoComplete="name"
                      />
                    </Field>
                    <Field label="Phone number">
                      <div className="flex gap-2">
                        <input
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                            setOtpSent(false);
                          }}
                          inputMode="numeric"
                          placeholder="10-digit mobile"
                          className={inputCls}
                          autoComplete="tel"
                        />
                        {verified ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success px-3 text-sm font-semibold text-success-foreground">
                            <Check className="size-4" /> Verified
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            disabled={phone.length !== 10 || busy}
                            onClick={async () => {
                              setBusy(true);
                              const r = await sendOtp(phone);
                              setBusy(false);
                              setOtpSent(true);
                              toast(r.hint);
                            }}
                          >
                            {otpSent ? "Resend" : "Send OTP"}
                          </Button>
                        )}
                      </div>
                    </Field>
                    {otpSent && !verified && (
                      <Field label="Enter OTP (demo: 1234)">
                        <div className="flex gap-2">
                          <input
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            inputMode="numeric"
                            className={cn(inputCls, "tracking-[0.5em]")}
                          />
                          <Button
                            disabled={otp.length !== 4 || busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await verifyOtp(phone, otp, name);
                                toast.success("Phone verified");
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                              setBusy(false);
                            }}
                          >
                            Verify
                          </Button>
                        </div>
                      </Field>
                    )}
                    <Field label="Notes for the kitchen (optional)">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className={cn(inputCls, "h-auto py-2")}
                      />
                    </Field>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setStep(0)}>
                        Back
                      </Button>
                      <Button
                        size="lg"
                        disabled={!verified || !name.trim()}
                        onClick={() => setStep(2)}
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                )}
                {step === 2 && (
                  <div className="space-y-5">
                    <h2 className="text-2xl font-bold">How do you want to pay?</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <PayOpt
                        on={payment === "online"}
                        onClick={() => setPayment("online")}
                        icon={<Wallet />}
                        t="Pay online"
                        d="Get a QR for express pickup"
                      />
                      <PayOpt
                        on={payment === "counter"}
                        onClick={() => setPayment("counter")}
                        icon={<Store />}
                        t="Pay at counter"
                        d="Pay when you collect. No QR."
                      />
                    </div>
                    <section className="rounded-2xl bg-muted p-4">
                      <p className="font-semibold">
                        Use your points ·{" "}
                        <span className="text-primary">{me?.points ?? 0} pts</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Chip on={!s.redeemStepId} onClick={() => setRedeem(null)}>
                          Save points
                        </Chip>
                        {db.loyalty.steps.map((r) => (
                          <Chip
                            key={r.id}
                            on={s.redeemStepId === r.id}
                            disabled={(me?.points ?? 0) < r.points}
                            onClick={() => setRedeem(r.id)}
                          >
                            {r.label} · {r.points} pts
                          </Chip>
                        ))}
                      </div>
                    </section>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setStep(1)}>
                        Back
                      </Button>
                      <Button
                        size="lg"
                        className="flex-1"
                        disabled={busy || short > 0}
                        onClick={() =>
                          payment === "online" ? setPayOpen(true) : finish("counter")
                        }
                      >
                        {busy && <Loader2 className="animate-spin" />}{" "}
                        {payment === "online" ? `Pay ${inr(bill.total)}` : "Place order"}
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <aside className="h-fit rounded-3xl bg-card p-5 shadow-warm md:sticky md:top-24">
            <h2 className="text-xl font-bold">Summary</h2>
            <p className="text-sm text-muted-foreground">
              {outlet?.short ?? "No outlet"} · {when === "asap" ? "ASAP" : fmtTime(when)}
            </p>
            <div className="my-4">
              <BillLines lines={s.cart} />
            </div>
            <form
              className="mb-3 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await applyCoupon(couponCode);
                  toast.success("Coupon applied");
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              <label className="sr-only" htmlFor="checkout-coupon">
                Coupon
              </label>
              <input
                id="checkout-coupon"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Coupon"
                className="h-11 min-w-0 flex-1 rounded-full border-2 border-input px-3 text-sm"
              />
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </form>
            {coupon && (
              <button
                type="button"
                className="mb-2 text-xs font-semibold text-primary"
                onClick={clearCoupon}
              >
                Remove {coupon.code}
              </button>
            )}
            <div className="border-t pt-3">
              <Row k="Subtotal" v={inr(bill.subtotal)} />
              {bill.rewardDiscount > 0 && (
                <Row k={`Reward · ${reward?.label}`} v={`- ${inr(bill.rewardDiscount)}`} />
              )}
              {bill.couponDiscount > 0 && (
                <Row k={`Coupon · ${coupon?.code}`} v={`- ${inr(bill.couponDiscount)}`} />
              )}
              {bill.packaging > 0 && <Row k="Packaging" v={inr(bill.packaging)} />}
              <Row k={`GST (${db.settings.taxPercent}%)`} v={inr(bill.tax)} />
              <Row k="Total" v={inr(bill.total)} bold />
              <p className="mt-1 text-xs text-muted-foreground">
                You'll earn {bill.pointsEarned} points on pickup. Online pay is a demo.
              </p>
              {short > 0 && (
                <p className="mt-2 text-sm font-semibold text-primary">
                  Add {inr(short)} to reach the minimum.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
      <PayModal
        open={payOpen}
        amount={bill.total}
        onClose={() => setPayOpen(false)}
        onSuccess={() => finish("online")}
      />
    </ShopLayout>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border-2 border-input bg-background px-3 outline-none focus:border-primary";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
function Chip({
  on,
  children,
  ...p
}: { on: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      aria-pressed={on}
      className={cn(
        "rounded-full border-2 px-3.5 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-40",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      {children}
    </button>
  );
}
function PayOpt({
  on,
  onClick,
  icon,
  t,
  d,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  t: string;
  d: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex gap-3 rounded-2xl border-2 p-4 text-left transition",
        on ? "border-primary bg-accent" : "border-border hover:border-primary/40",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
        {icon}
      </span>
      <span>
        <b className="block">{t}</b>
        <span className="text-sm text-muted-foreground">{d}</span>
      </span>
    </button>
  );
}

function PayModal({
  open,
  amount,
  onClose,
  onSuccess,
}: {
  open: boolean;
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tab, setTab] = useState<"upi" | "card" | "net">("upi");
  const [paying, setPaying] = useState(false);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-cocoa/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Demo payment"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-lift"
          >
            <div className="flex items-center justify-between bg-cocoa px-5 py-4 text-cream">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-warning">
                  Demo · no real payment
                </p>
                <p className="font-display text-2xl">{inr(amount)}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Cancel payment"
                className="grid size-9 place-items-center rounded-full hover:bg-cream/10"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex border-b">
              {(
                [
                  ["upi", "UPI", Smartphone],
                  ["card", "Card", CreditCard],
                  ["net", "Netbanking", Landmark],
                ] as const
              ).map(([k, l, I]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-semibold",
                    tab === k ? "border-b-2 border-primary text-primary" : "text-muted-foreground",
                  )}
                >
                  <I className="size-4" />
                  {l}
                </button>
              ))}
            </div>
            <div className="space-y-3 p-5">
              {tab === "upi" && (
                <input defaultValue="grizzlyfan@upi" aria-label="UPI ID" className={inputCls} />
              )}
              {tab === "card" && (
                <>
                  <input
                    defaultValue="4111 1111 1111 1111"
                    aria-label="Card number"
                    className={inputCls}
                  />
                  <div className="flex gap-2">
                    <input defaultValue="12/29" aria-label="Expiry" className={inputCls} />
                    <input defaultValue="123" aria-label="CVV" className={inputCls} />
                  </div>
                </>
              )}
              {tab === "net" && (
                <select className={inputCls} aria-label="Bank">
                  <option>HDFC Bank</option>
                  <option>ICICI Bank</option>
                  <option>SBI</option>
                </select>
              )}
              <Button
                size="lg"
                className="w-full"
                disabled={paying}
                onClick={async () => {
                  setPaying(true);
                  await new Promise((r) => setTimeout(r, 1200));
                  setPaying(false);
                  onSuccess();
                }}
              >
                {paying ? (
                  <>
                    <Loader2 className="animate-spin" /> Processing…
                  </>
                ) : (
                  `Pay ${inr(amount)} (simulated)`
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Nothing is charged. This is a demo checkout.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
