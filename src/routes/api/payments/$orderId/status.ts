import { createFileRoute } from "@tanstack/react-router";
import { paymentStatus } from "@/data/payments";
import { readIdentities } from "@/data/session";

export const Route = createFileRoute("/api/payments/$orderId/status")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const ident = await readIdentities();
          const status = await paymentStatus(ident, params.orderId);
          return Response.json({ ok: true, ...status });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Order not found.";
          const status = /sign in/i.test(message) ? 401 : 404;
          return Response.json({ ok: false, error: message }, { status });
        }
      },
    },
  },
});
