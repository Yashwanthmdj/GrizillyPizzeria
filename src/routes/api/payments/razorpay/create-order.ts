import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { startOnlineCheckout } from "@/data/payments";
import { readIdentities } from "@/data/session";
import type { CartLine } from "@/services/types";

const bodySchema = z.object({
  name: z.string().min(1).max(80),
  notes: z.string().max(240).optional(),
  scheduledFor: z.number().optional(),
  cart: z.array(z.object({ itemId: z.string(), qty: z.number() }).passthrough()).min(1),
  outletId: z.string().nullable(),
  redeemStepId: z.string().nullable(),
  couponCode: z.string().nullable(),
  checkoutKey: z.string().min(8).max(80),
});

export const Route = createFileRoute("/api/payments/razorpay/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const json = await readJson(request);
          const body = bodySchema.parse(json);
          const { customer } = await readIdentities();
          const { notes, scheduledFor, ...rest } = body;
          const session = await startOnlineCheckout(customer, {
            ...rest,
            cart: rest.cart as unknown as CartLine[],
            ...(notes ? { notes } : {}),
            ...(scheduledFor ? { scheduledFor } : {}),
          });
          return Response.json({ ok: true, ...session });
        } catch (error) {
          return paymentError(error);
        }
      },
    },
  },
});

async function readJson(request: Request) {
  const text = await request.text();
  if (!text || text.length > 100_000) throw new Error("Bad request.");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Malformed JSON.");
  }
}

function paymentError(error: unknown) {
  if (error && typeof error === "object" && "issues" in error) {
    return Response.json({ ok: false, error: "Check the checkout details and try again." }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Payment failed.";
  const status = /sign in/i.test(message) ? 401 : /not found|another customer/i.test(message) ? 404 : 400;
  return Response.json({ ok: false, error: message }, { status });
}
