export type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayCheckoutSession = {
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: "INR";
  description: string;
  prefillName: string;
  prefillContact: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: () => void) => void;
};

type RazorpayWindow = Window & {
  Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
};

let loading: Promise<boolean> | null = null;

function loadCheckoutScript() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if ((window as RazorpayWindow).Razorpay) return Promise.resolve(true);
  if (!loading) {
    loading = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        loading = null;
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }
  return loading;
}

/** Opens Razorpay Checkout. Resolves only after the modal closes or the handler finishes. */
export async function openRazorpayCheckout(
  session: RazorpayCheckoutSession,
  onSuccess: (response: RazorpaySuccess) => Promise<void>,
): Promise<"paid" | "dismissed" | "failed"> {
  const ready = await loadCheckoutScript();
  const Razorpay = (window as RazorpayWindow).Razorpay;
  if (!ready || !Razorpay) throw new Error("Could not open Razorpay. Check your connection and try again.");

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: "paid" | "dismissed" | "failed") => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const checkout = new Razorpay({
      key: session.keyId,
      amount: session.amountPaise,
      currency: session.currency,
      name: "Grizzly Pizzeria",
      description: session.description,
      order_id: session.razorpayOrderId,
      prefill: { name: session.prefillName, contact: session.prefillContact },
      theme: { color: "#AF2225" },
      handler: (response: RazorpaySuccess) => {
        void onSuccess(response)
          .then(() => finish("paid"))
          .catch(() => finish("failed"));
      },
      modal: {
        ondismiss: () => finish("dismissed"),
        confirm_close: true,
      },
    });
    checkout.on("payment.failed", () => finish("failed"));
    checkout.open();
  });
}
