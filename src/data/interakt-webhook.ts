import { interaktConfig, verifyInteraktWebhookSignature } from "./interakt";
import { recordWebhookEvent } from "./whatsapp-outbox";

function providerMessageId(data: Record<string, unknown>): string | null {
  const message = data["message"];
  if (message && typeof message === "object") {
    const id = (message as Record<string, unknown>)["id"];
    if (typeof id === "string" && id) return id;
  }
  const id = data["id"];
  return typeof id === "string" && id ? id : null;
}

/**
 * Handle Interakt delivery-status webhooks.
 * Verifies Interakt-Signature (HMAC-SHA256) when INTERAKT_WEBHOOK_SECRET is set.
 */
export async function handleInteraktWebhook(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await request.text();
  if (!rawBody || rawBody.length > 200_000) {
    return new Response("Bad request", { status: 400 });
  }

  const cfg = interaktConfig();
  const signature = request.headers.get("Interakt-Signature") ?? request.headers.get("interakt-signature");

  if (cfg.webhookSecret) {
    if (!verifyInteraktWebhookSignature(cfg.webhookSecret, rawBody, signature)) {
      return new Response("Invalid signature", { status: 401 });
    }
  } else if (process.env["NODE_ENV"] === "production") {
    console.error("[interakt-webhook] INTERAKT_WEBHOOK_SECRET is not configured");
    return new Response("Webhook not configured", { status: 503 });
  }

  let parsed: { type?: unknown; data?: unknown; id?: unknown };
  try {
    parsed = JSON.parse(rawBody) as typeof parsed;
  } catch {
    return new Response("Malformed JSON", { status: 400 });
  }

  const eventType = typeof parsed.type === "string" ? parsed.type : "";
  if (!eventType) {
    return new Response("Missing type", { status: 400 });
  }

  // Growth plan: delivery statuses only. Ignore inbound unless entitlement is confirmed later.
  if (eventType === "message_received") {
    return Response.json({ ok: true, ignored: true });
  }

  const data =
    parsed.data && typeof parsed.data === "object" ? (parsed.data as Record<string, unknown>) : {};
  const msgId = providerMessageId(data) ?? (typeof parsed.id === "string" ? parsed.id : null);
  const eventKey = `${eventType}:${msgId ?? "none"}:${createStableHash(rawBody)}`;

  const result = await recordWebhookEvent({
    eventKey,
    eventType,
    providerMessageId: msgId,
    payload: { type: eventType },
  });

  return Response.json({ ok: true, duplicate: result.duplicate });
}

function createStableHash(raw: string) {
  let h = 0;
  for (let i = 0; i < Math.min(raw.length, 4000); i++) {
    h = (h * 31 + raw.charCodeAt(i)) | 0;
  }
  return String(h >>> 0);
}
