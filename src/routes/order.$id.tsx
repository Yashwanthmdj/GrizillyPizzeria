import { createFileRoute, Link } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { Download, MessageCircle, Share2, Timer } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHead, ShopLayout, seo } from "@/components/shop/ShopLayout";
import { BillLines, Row } from "@/components/shop/Bill";
import { OrderTracker } from "@/components/shop/OrderTracker";

const Confetti = lazy(() =>
  import("@/components/shop/Confetti").then((m) => ({ default: m.Confetti })),
);
import { useDB } from "@/services/store";
import { resumeRazorpayCheckout, verifyRazorpayPayment } from "@/services/api";
import { openRazorpayCheckout } from "@/components/shop/razorpay-checkout";
import { paymentCaption } from "@/services/payment-status";
import { inr } from "@/services/pricing";
import { minutesPerOrder, waitForOrder } from "@/services/wait";
import type { Order, OrderStatus } from "@/services/types";

export const Route = createFileRoute("/order/$id")({
  head: () => ({
    ...seo("Your order · Grizzly Pizzeria", "Track your Grizzly Pizzeria order live."),
    meta: [
      ...seo("Your order · Grizzly Pizzeria", "Track your Grizzly Pizzeria order live.").meta,
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderPage,
});

const MSG: Record<OrderStatus, (o: Order) => string> = {
  Placed: (o) => `🐻 Hi ${o.customerName}! Order #${o.number} received. Total ${inr(o.total)}.`,
  Accepted: (o) => `✅ Order #${o.number} accepted. The ovens are warming up.`,
  Preparing: () => `🔥 Your pizza is in the oven. Smells illegal.`,
  Ready: (o) =>
    `🍕 Order #${o.number} is READY! ${o.payment === "online" ? "Show your QR" : "Pay at the counter"} to collect.`,
  Collected: (o) => `🎉 Enjoy! You earned ${o.pointsEarned} points.`,
  Rejected: (o) => `😔 Sorry, order #${o.number} couldn't be accepted: ${o.rejectReason ?? ""}`,
};


async function retryPayment(order: Order, setPaying: (busy: boolean) => void) {
  setPaying(true);
  try {
    const session = await resumeRazorpayCheckout(order.id);
    if (session.alreadyPaid) {
      toast.success(`Order #${session.number} is already paid.`);
      return;
    }
    const result = await openRazorpayCheckout(
      {
        keyId: session.keyId,
        razorpayOrderId: session.razorpayOrderId,
        amountPaise: session.amountPaise,
        currency: "INR",
        description: `Order #${session.number}`,
        prefillName: session.prefillName,
        prefillContact: session.prefillContact,
      },
      async (response) => {
        const paid = await verifyRazorpayPayment({
          orderId: session.orderId,
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        });
        if (!paid.paid) throw new Error("Payment is not confirmed yet.");
        toast.success(`Order #${paid.number} paid!`);
      },
    );
    if (result === "failed") toast.error("Payment didn't go through. You can try again.");
    if (result === "dismissed") toast("Payment was not completed.");
  } catch (error) {
    toast.error((error as Error).message);
  } finally {
    setPaying(false);
  }
}

function OrderPage() {
  const { id } = Route.useParams();
  const db = useDB();
  const o = db.orders.find((x) => x.id === id);
  const prev = useRef(o?.status);
  const [party, setParty] = useState(false);
  const [paying, setPaying] = useState(false);
  useEffect(() => {
    if (o && o.status === "Ready" && prev.current !== "Ready") {
      setParty(true);
      toast.success("Your order is ready! 🍕");
      setTimeout(() => setParty(false), 3500);
    }
    prev.current = o?.status;
  }, [o?.status, o]);
  if (!o)
    return (
      <ShopLayout>
        <PageHead title="Order not found" sub="That order number isn't in our books." />
        <div className="py-10 text-center">
          <Button asChild>
            <Link to="/orders">My orders</Link>
          </Button>
        </div>
      </ShopLayout>
    );
  const outlet = db.outlets.find((x) => x.id === o.outletId);
  const live = !["Collected", "Rejected"].includes(o.status);
  const perOrder = minutesPerOrder(outlet);
  const readyIn = waitForOrder(db.orders, o.outletId, o.id, perOrder);
  const showQr = o.payment === "online" && o.paid && !!o.qrToken;
  const awaitingPayment = o.payment === "online" && !o.paid;
  const qrValue = JSON.stringify({ id: o.id, o: o.outletId, t: o.qrToken });
  const leftover = o.lines.filter((l) => l.lineStatus !== "collected");

  return (
    <ShopLayout>
      {party && (
        <Suspense fallback={null}>
          <Confetti />
        </Suspense>
      )}
      <PageHead
        eyebrow={outlet?.name}
        title={`Order #${o.number}`}
        sub={
          awaitingPayment
            ? "Payment isn't complete yet. The kitchen starts after Razorpay confirms it."
            : live
              ? o.status === "Ready"
                ? showQr
                  ? "Ready now — show your QR at the counter"
                  : "Ready now — tell them your order number"
                : `Order will be ready in ${readyIn} min`
              : `Status: ${o.status}`
        }
      />
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
        {live && (
          <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-cocoa p-5 text-cream">
            <Timer className="size-8 text-secondary" />
            <div className="flex-1">
              <p className="text-sm text-cream/70">
                {o.status === "Ready" ? "Status" : "Order will be ready in"}
              </p>
              <p className="font-display text-4xl tabular-nums" aria-live="polite">
                {o.status === "Ready" ? "Ready" : `${readyIn} min`}
              </p>
            </div>
            {o.status !== "Ready" ? (
              <p className="text-sm text-cream/70">
                {perOrder} min per order · updates as the queue moves
              </p>
            ) : null}
          </div>
        )}
        <OrderTracker order={o} />
        <ul className="grid gap-2 rounded-3xl bg-card p-5 shadow-warm sm:grid-cols-2">
          {o.lines.map((l) => (
            <li key={l.lineId || l.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
              <span className="min-w-0">
                {l.qty}× {l.name}
                {l.size ? ` (${l.size})` : ""}
              </span>
              <span className="font-semibold capitalize">
                {l.lineStatus === "ready"
                  ? showQr
                    ? "Ready — show QR"
                    : "Ready — pay at counter"
                  : l.lineStatus === "collected"
                    ? "Handed over"
                    : l.lineStatus}
              </span>
            </li>
          ))}
        </ul>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="ticket rounded-3xl bg-secondary p-6 text-center text-cocoa shadow-warm">
            {showQr ? (
              <>
                <p className="text-sm font-bold uppercase tracking-widest text-primary-deep">
                  Show this at the counter
                </p>
                <div className="mx-auto mt-4 w-full max-w-[240px] rounded-2xl bg-card p-4">
                  <QRCodeSVG
                    id="order-qr"
                    value={qrValue}
                    size={210}
                    className="h-auto w-full"
                    fgColor="#2A1412"
                    bgColor="transparent"
                    level="M"
                  />
                </div>
                <p className="mt-3 font-display text-3xl">#{o.number}</p>
                <p className="text-sm">
                  {leftover.length
                    ? leftover.some((l) => l.lineStatus === "ready")
                      ? "Show this for items that are ready. Come back for the rest."
                      : "Kitchen is still on it — QR works as soon as something is ready."
                    : "All items handed over ✓"}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button size="sm" onClick={() => downloadQR(o.number)}>
                    <Download /> Download
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => share(o)}>
                    <Share2 /> Share
                  </Button>
                </div>
              </>
            ) : awaitingPayment ? (
              <div className="py-8">
                <p className="font-display text-5xl">#{o.number}</p>
                <p className="mt-3 text-lg font-semibold">{paymentCaption(o)}</p>
                <p className="text-sm">Pay to send this order to the kitchen.</p>
                <Button
                  className="mt-4"
                  disabled={paying}
                  onClick={() => void retryPayment(o, setPaying)}
                >
                  {paying ? "Opening payment…" : `Pay ${inr(o.total)}`}
                </Button>
              </div>
            ) : o.payment === "online" ? (
              <div className="py-10">
                <p className="font-display text-5xl">#{o.number}</p>
                <p className="mt-3 text-lg font-semibold">Your pickup QR is on its way.</p>
                <p className="text-sm">
                  It appears here when the kitchen marks this order ready.
                </p>
              </div>
            ) : (
              <div className="py-10">
                <p className="font-display text-5xl">#{o.number}</p>
                <p className="mt-3 text-lg font-semibold">Pay at the counter when you collect.</p>
                <p className="text-sm">Just tell them your order number.</p>
              </div>
            )}
          </div>
          <div className="rounded-3xl bg-card p-6 shadow-warm" id="bill">
            <h2 className="text-2xl font-bold">Bill</h2>
            <p className="text-xs text-muted-foreground">
              {new Date(o.createdAt).toLocaleString("en-IN")} ·{" "}
              {paymentCaption(o)}
            </p>
            <div className="my-4">
              <BillLines lines={o.lines} />
            </div>
            <div className="border-t pt-3">
              <Row k="Subtotal" v={inr(o.subtotal)} />
              {o.discount - (o.couponDiscount ?? 0) > 0 && (
                <Row k="Reward discount" v={`- ${inr(o.discount - (o.couponDiscount ?? 0))}`} />
              )}
              {(o.couponDiscount ?? 0) > 0 && (
                <Row k={`Coupon ${o.couponCode ?? ""}`} v={`- ${inr(o.couponDiscount ?? 0)}`} />
              )}
              {(o.packaging ?? 0) > 0 && <Row k="Packaging" v={inr(o.packaging ?? 0)} />}
              <Row k="GST" v={inr(o.tax)} />
              <Row k="Total" v={inr(o.total)} bold />
              {o.pointsUsed > 0 && <Row k="Points used" v={`${o.pointsUsed}`} />}
              <Row
                k={o.status === "Collected" ? "Points earned" : "Points on pickup"}
                v={`+${o.pointsEarned}`}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Download /> Download PDF
              </Button>
              <Button
                size="sm"
                variant="success"
                onClick={() =>
                  toast("Opening WhatsApp", {
                    description: "Nothing was actually sent.",
                  })
                }
              >
                <MessageCircle /> Share on WhatsApp
              </Button>
            </div>
          </div>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-warm print:hidden">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">WhatsApp updates</h2>
            <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-bold text-warning-foreground">
              Simulated
            </span>
          </div>
          <div className="mt-4 space-y-2 rounded-2xl bg-muted p-4">
            {o.history.map((h, i) => (
              <div
                key={i}
                className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card px-4 py-2 text-sm shadow-warm"
              >
                {MSG[h.status](o)}
                <span className="mt-1 block text-right text-[10px] text-muted-foreground">
                  {new Date(h.at).toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}

function downloadQR(n: number) {
  const svg = document.getElementById("order-qr");
  if (!svg) return;
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `grizzly-order-${n}.svg`;
  a.click();
}
async function share(o: Order) {
  const text = `My Grizzly Pizzeria order #${o.number}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: text, url: location.href });
    } catch {
      /* cancelled */
    }
  } else {
    await navigator.clipboard.writeText(location.href);
    toast.success("Link copied");
  }
}
