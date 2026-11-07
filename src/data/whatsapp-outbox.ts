import { uid } from "@/lib/id";
import {
  interaktConfig,
  mapInteraktWebhookType,
  sendMarketingTemplate,
  sendOrderConfirmation,
  sendTemplate,
  type InteraktDeliveryStatus,
} from "./interakt";
import { exec, parseJson, serialize } from "./db";

export type OutboxKind = "order_confirmation" | "order_status" | "marketing" | "otp" | "template";
export type OutboxStatus = "pending" | "sending" | InteraktDeliveryStatus | "skipped";

type OutboxRow = {
  id: string;
  idempotency_key: string;
  kind: OutboxKind;
  phone: string;
  template_name: string;
  payload: string;
  status: OutboxStatus;
  provider_message_id: string | null;
  attempts: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
  sent_at: number | null;
};

function row(r: object) {
  return r as Record<string, unknown>;
}
function s(r: object, key: string) {
  const v = row(r)[key];
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function n(r: object, key: string) {
  return Number(row(r)[key] ?? 0);
}
function maybeS(r: object, key: string) {
  const v = row(r)[key];
  return typeof v === "string" ? v : null;
}

export async function enqueueWhatsApp(input: {
  idempotencyKey: string;
  kind: OutboxKind;
  phone: string;
  templateName: string;
  payload: Record<string, unknown>;
}) {
  const now = Date.now();
  const id = `wa_${uid()}`;
  await exec(
    `INSERT INTO whatsapp_outbox
      (id, idempotency_key, kind, phone, template_name, payload, status, attempts, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)
     ON CONFLICT(idempotency_key) DO NOTHING`,
    [
      id,
      input.idempotencyKey,
      input.kind,
      input.phone,
      input.templateName,
      JSON.stringify(input.payload),
      now,
      now,
    ],
  );
  return input.idempotencyKey;
}

async function loadByIdempotency(key: string) {
  const rs = await exec("SELECT * FROM whatsapp_outbox WHERE idempotency_key = ?", [key]);
  return rs.rows[0] ?? null;
}

async function mark(
  id: string,
  patch: {
    status: OutboxStatus;
    providerMessageId?: string | null;
    lastError?: string | null;
    attempts?: number;
    sentAt?: number | null;
  },
) {
  const now = Date.now();
  await exec(
    `UPDATE whatsapp_outbox
     SET status = ?, provider_message_id = COALESCE(?, provider_message_id),
         last_error = ?, attempts = COALESCE(?, attempts),
         sent_at = COALESCE(?, sent_at), updated_at = ?
     WHERE id = ?`,
    [
      patch.status,
      patch.providerMessageId ?? null,
      patch.lastError ?? null,
      patch.attempts ?? null,
      patch.sentAt ?? null,
      now,
      id,
    ],
  );
}

async function dispatchRow(raw: object) {
  const id = s(raw, "id");
  const kind = s(raw, "kind") as OutboxKind;
  const phone = s(raw, "phone");
  const templateName = s(raw, "template_name");
  const attempts = n(raw, "attempts") + 1;
  const payload = parseJson<Record<string, unknown>>(maybeS(raw, "payload"), {});
  const status = s(raw, "status");

  if (status === "sent" || status === "delivered" || status === "read" || status === "skipped") {
    return;
  }

  await mark(id, { status: "sending", attempts });

  const callbackData = String(payload["callbackData"] ?? id);
  const bodyValues = Array.isArray(payload["bodyValues"]) ? (payload["bodyValues"] as string[]) : undefined;
  const buttonValues =
    payload["buttonValues"] && typeof payload["buttonValues"] === "object"
      ? (payload["buttonValues"] as Record<string, string[]>)
      : undefined;

  let result;
  if (kind === "order_confirmation") {
    result = await sendOrderConfirmation({
      phone,
      customerName: String(payload["customerName"] ?? "Guest"),
      orderNumber: String(payload["orderNumber"] ?? ""),
      orderTotal: String(payload["orderTotal"] ?? ""),
      callbackData,
    });
  } else if (kind === "marketing") {
    result = await sendMarketingTemplate({
      phone,
      callbackData,
      ...(bodyValues ? { bodyValues } : {}),
    });
  } else {
    result = await sendTemplate({
      phone,
      callbackData,
      template: {
        name: templateName,
        languageCode: "en",
        ...(bodyValues ? { bodyValues } : {}),
        ...(buttonValues ? { buttonValues } : {}),
      },
    });
  }

  if (result.skipped) {
    await mark(id, { status: "skipped", lastError: result.reason ?? "skipped", attempts });
    return;
  }
  if (!result.accepted) {
    await mark(id, { status: "failed", lastError: result.reason ?? "send failed", attempts });
    return;
  }
  await mark(id, {
    status: "sent",
    providerMessageId: result.providerMessageId ?? null,
    lastError: null,
    attempts,
    sentAt: Date.now(),
  });
}

/** Process one pending outbox row by idempotency key (safe to call fire-and-forget). */
export async function processWhatsAppOutbox(idempotencyKey: string) {
  return serialize(async () => {
    const raw = await loadByIdempotency(idempotencyKey);
    if (!raw) return;
    await dispatchRow(raw);
  });
}

export function enqueueOrderConfirmationSafe(input: {
  orderId: string;
  phone: string;
  customerName: string;
  orderNumber: number;
  orderTotal: number;
}) {
  const cfg = interaktConfig();
  const key = `order_confirm:${input.orderId}`;
  void (async () => {
    try {
      await enqueueWhatsApp({
        idempotencyKey: key,
        kind: "order_confirmation",
        phone: input.phone,
        templateName: cfg.orderConfirmationTemplate,
        payload: {
          customerName: input.customerName,
          orderNumber: input.orderNumber,
          orderTotal: input.orderTotal,
          callbackData: key,
        },
      });
      await processWhatsAppOutbox(key);
    } catch (err) {
      console.error("[whatsapp-outbox] order confirmation enqueue failed", {
        reason: err instanceof Error ? err.message : "unknown",
      });
    }
  })();
}

export async function recordWebhookEvent(input: {
  eventKey: string;
  eventType: string;
  providerMessageId?: string | null;
  payload: unknown;
}) {
  const now = Date.now();
  try {
    await exec(
      `INSERT INTO whatsapp_webhook_events (id, event_key, event_type, provider_message_id, payload, received_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `whe_${uid()}`,
        input.eventKey,
        input.eventType,
        input.providerMessageId ?? null,
        JSON.stringify(input.payload),
        now,
      ],
    );
  } catch {
    return { duplicate: true as const };
  }

  const status = mapInteraktWebhookType(input.eventType);
  if (status && input.providerMessageId) {
    await exec(
      `UPDATE whatsapp_outbox
       SET status = ?, updated_at = ?
       WHERE provider_message_id = ?`,
      [status, now, input.providerMessageId],
    );
  }
  return { duplicate: false as const };
}

export async function setMarketingConsent(phone: string, consented: boolean, source: string) {
  const now = Date.now();
  await exec(
    `UPDATE customers
     SET wa_marketing_consent = ?, wa_marketing_consent_at = ?, wa_marketing_consent_source = ?
     WHERE phone = ?`,
    [consented ? 1 : 0, now, source, phone],
  );
}

export async function enqueueMarketingIfConsented(input: {
  phone: string;
  bodyValues?: string[];
  campaignKey: string;
}) {
  const cfg = interaktConfig();
  if (!cfg.marketingApproved) {
    return { ok: false as const, reason: "Marketing template not approved" };
  }
  const rs = await exec(
    "SELECT wa_marketing_consent FROM customers WHERE phone = ?",
    [input.phone.replace(/\D/g, "")],
  );
  const consent = Number((rs.rows[0] as Record<string, unknown> | undefined)?.["wa_marketing_consent"] ?? 0);
  if (!consent) {
    return { ok: false as const, reason: "Customer has not consented to WhatsApp marketing" };
  }
  const key = `marketing:${input.campaignKey}:${input.phone}`;
  await enqueueWhatsApp({
    idempotencyKey: key,
    kind: "marketing",
    phone: input.phone,
    templateName: cfg.marketingTemplate,
    payload: {
      bodyValues: input.bodyValues ?? [],
      callbackData: key,
    },
  });
  void processWhatsAppOutbox(key);
  return { ok: true as const };
}

export type { OutboxRow };
