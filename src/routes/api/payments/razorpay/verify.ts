import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyOnlinePayment } from "@/data/payments";
import { readIdentities } from "@/data/session";

const bodySchema = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export const Route = createFileRoute("/api/payments/razorpay/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const text = await request.text();
          if (!text || text.length > 20_000) throw new Error("Bad request.");
          const body = bodySchema.parse(JSON.parse(text) as unknown);
          const { customer } = await readIdentities();
          const order = await verifyOnlinePayment(customer, body);
          return Response.json({
            ok: true,
            orderId: order.id,
            number: order.number,
            paid: order.paid,
            paymentStatus: order.paymentStatus ?? (order.paid ? "PAID" : "PENDING"),
          });
        } catch (error) {
          if (error && typeof error === "object" && "issues" in error) {
            return Response.json({ ok: false, error: "Check the payment details and try again." }, { status: 400 });
          }
          const message = error instanceof Error ? error.message : "Payment failed.";
          const status = /sign in/i.test(message) ? 401 : /not found/i.test(message) ? 404 : 400;
          return Response.json({ ok: false, error: message }, { status });
        }
      },
    },
  },
});
