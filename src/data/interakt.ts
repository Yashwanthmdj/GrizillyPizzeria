import { createHmac, timingSafeEqual } from "node:crypto";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

export type InteraktDeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";

export type InteraktSendResult = {
  accepted: boolean;
  providerMessageId?: string;
  skipped?: boolean;
  reason?: string;
};

export type InteraktTemplatePayload = {
  name: string;
  languageCode?: string;
  headerValues?: string[];
  bodyValues?: string[];
  buttonValues?: Record<string, string[]>;
  fileName?: string;
};

export type NormalizedPhone = {
  countryCode: string;
  phoneNumber: string;
  e164Digits: string;
};

type InteraktConfig = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  defaultCountryCode: string;
  otpTemplate: string;
  otpLanguage: string;
  orderConfirmationTemplate: string;
  orderConfirmationApproved: boolean;
  marketingTemplate: string;
  marketingApproved: boolean;
  webhookSecret: string;
  timeoutMs: number;
};

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 2;

function envFlag(name: string, fallback = false) {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

export function interaktConfig(): InteraktConfig {
  return {
    enabled: envFlag("INTERAKT_ENABLED", false),
    apiKey: process.env["INTERAKT_API_KEY"]?.trim() ?? "",
    baseUrl: (process.env["INTERAKT_API_BASE_URL"]?.trim() || "https://api.interakt.ai").replace(/\/$/, ""),
    defaultCountryCode: process.env["INTERAKT_DEFAULT_COUNTRY_CODE"]?.trim() || "+91",
    otpTemplate: process.env["INTERAKT_OTP_TEMPLATE"]?.trim() || "grizzly_login_otp",
    // Must match Interakt/Meta template language exactly (grizzly_login_otp is en).
    otpLanguage: process.env["INTERAKT_OTP_LANG"]?.trim() || "en",
    orderConfirmationTemplate:
      process.env["INTERAKT_ORDER_CONFIRMATION_TEMPLATE"]?.trim() || "order_confirmation__grizzly_pizzeria",
    orderConfirmationApproved: envFlag("INTERAKT_ORDER_CONFIRMATION_APPROVED", false),
    marketingTemplate: process.env["INTERAKT_MARKETING_TEMPLATE"]?.trim() || "grizzly_weekend_offer",
    marketingApproved: envFlag("INTERAKT_MARKETING_APPROVED", false),
    webhookSecret: process.env["INTERAKT_WEBHOOK_SECRET"]?.trim() ?? "",
    timeoutMs: Number(process.env["INTERAKT_TIMEOUT_MS"] ?? DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  };
}

export function normalizeInteraktPhone(raw: string, defaultCountryCode = "+91"): NormalizedPhone {
  const digits = raw.replace(/\D/g, "");
  const ccDigits = defaultCountryCode.replace(/\D/g, "") || "91";
  let national = digits;
  let countryCode = `+${ccDigits}`;

  if (digits.length === 10) {
    national = digits;
  } else if (digits.length === 12 && digits.startsWith(ccDigits)) {
    national = digits.slice(ccDigits.length);
    countryCode = `+${ccDigits}`;
  } else if (digits.length > 10 && digits.startsWith("91") && digits.length === 12) {
    national = digits.slice(2);
    countryCode = "+91";
  } else if (digits.length >= 11 && digits.length <= 15) {
    // Best-effort: last 10 as national for IN-style numbers, else keep as-is under default CC.
    national = digits.slice(-10);
  } else {
    throw new Error("Enter a valid mobile number.");
  }

  if (national.length < 8 || national.length > 12) {
    throw new Error("Enter a valid mobile number.");
  }

  return {
    countryCode,
    phoneNumber: national,
    e164Digits: `${countryCode.replace(/\D/g, "")}${national}`,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authHeader(apiKey: string) {
  // Interakt expects: Authorization: Basic <API_KEY>
  // The dashboard secret key is already the Basic credential value.
  return `Basic ${apiKey}`;
}

/** Mask all but last 4 digits for logs. */
export function maskPhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length < 4) return "****";
  return `${"*".repeat(Math.max(0, d.length - 4))}${d.slice(-4)}`;
}

/** Sanitized view of an Interakt request — never includes OTP, key, or full phone. */
export function describeInteraktPayload(body: Record<string, unknown>) {
  const template =
    body["template"] && typeof body["template"] === "object"
      ? (body["template"] as Record<string, unknown>)
      : {};
  const bodyValues = Array.isArray(template["bodyValues"]) ? template["bodyValues"] : [];
  const buttonValues =
    template["buttonValues"] && typeof template["buttonValues"] === "object"
      ? (template["buttonValues"] as Record<string, unknown>)
      : {};
  const button0 = Array.isArray(buttonValues["0"]) ? buttonValues["0"] : [];
  return {
    topKeys: Object.keys(body).sort(),
    templateKeys: Object.keys(template).sort(),
    templateName: typeof template["name"] === "string" ? template["name"] : null,
    languageCode: typeof template["languageCode"] === "string" ? template["languageCode"] : null,
    countryCode: typeof body["countryCode"] === "string" ? body["countryCode"] : null,
    phoneMasked: typeof body["phoneNumber"] === "string" ? maskPhone(String(body["phoneNumber"])) : null,
    type: typeof body["type"] === "string" ? body["type"] : null,
    bodyValueCount: bodyValues.length,
    button0Count: button0.length,
    bodyAndButtonLengthsMatch:
      bodyValues.length === 1 &&
      button0.length === 1 &&
      typeof bodyValues[0] === "string" &&
      typeof button0[0] === "string" &&
      bodyValues[0].length === button0[0].length,
    hasCallbackData: Object.prototype.hasOwnProperty.call(body, "callbackData"),
  };
}

/**
 * Docs-minimal Authentication / Copy Code payload for Interakt.
 * @see https://www.interakt.shop/resource-center/send-whatsapp-authentication-template/
 */
export function buildAuthenticationOtpRequest(input: {
  phone: string;
  code: string;
  templateName?: string;
  languageCode?: string;
  countryCode?: string;
}) {
  const cfg = interaktConfig();
  const phone = normalizeInteraktPhone(input.phone, input.countryCode || cfg.defaultCountryCode);
  if (phone.countryCode === "+91" && phone.phoneNumber.length !== 10) {
    throw new Error("Enter a valid 10-digit mobile number.");
  }
  if (!/^\d{4,15}$/.test(input.code)) {
    throw new Error("Invalid OTP format");
  }
  return {
    countryCode: phone.countryCode,
    phoneNumber: phone.phoneNumber,
    type: "Template" as const,
    template: {
      name: input.templateName || cfg.otpTemplate,
      languageCode: input.languageCode || cfg.otpLanguage,
      bodyValues: [input.code],
      buttonValues: { "0": [input.code] },
    },
  };
}

async function postMessage(
  cfg: InteraktConfig,
  body: Record<string, unknown>,
): Promise<InteraktSendResult> {
  if (!cfg.enabled) {
    return { accepted: false, skipped: true, reason: "Interakt disabled" };
  }
  if (!cfg.apiKey) {
    return { accepted: false, skipped: true, reason: "Interakt API key missing" };
  }

  const url = `${cfg.baseUrl}/v1/public/message/`;
  const shape = describeInteraktPayload(body);
  console.info("[interakt] request", { url, authScheme: "Basic", ...shape });

  let lastError = "Interakt request failed";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader(cfg.apiKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        lastError = res.status === 429 ? "Interakt rate limited" : "Interakt unavailable";
        if (attempt < MAX_RETRIES) {
          await sleep(400 * (attempt + 1));
          continue;
        }
        console.error("[interakt] send failed", { status: res.status, reason: lastError, ...shape });
        return { accepted: false, reason: lastError };
      }

      const text = await res.text();
      let json: { result?: boolean; message?: string; id?: string } = {};
      try {
        json = text ? (JSON.parse(text) as typeof json) : {};
      } catch {
        json = {};
      }

      if (!res.ok || json.result === false) {
        console.error("[interakt] send rejected", {
          status: res.status,
          message: json.message ?? "rejected",
          providerMessageId: json.id ?? null,
          ...shape,
        });
        return { accepted: false, reason: "Could not send WhatsApp message." };
      }

      console.info("[interakt] api accepted", {
        status: res.status,
        providerMessageId: json.id ?? null,
        interaktMessage: json.message ?? null,
        note: "API acceptance is not WhatsApp delivery",
        ...shape,
      });

      return {
        accepted: true,
        ...(json.id ? { providerMessageId: json.id } : {}),
      };
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof Error && err.name === "AbortError";
      lastError = aborted ? "Interakt timeout" : "Interakt network error";
      console.error("[interakt] send error", { reason: lastError, attempt, ...shape });
      if (attempt < MAX_RETRIES) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      return { accepted: false, reason: lastError };
    }
  }

  return { accepted: false, reason: lastError };
}

export async function sendTemplate(input: {
  phone: string;
  template: InteraktTemplatePayload;
  callbackData?: string;
  campaignId?: string;
}): Promise<InteraktSendResult> {
  const cfg = interaktConfig();
  const phone = normalizeInteraktPhone(input.phone, cfg.defaultCountryCode);
  const template: Record<string, unknown> = {
    name: input.template.name,
    languageCode: input.template.languageCode || "en",
  };
  if (input.template.headerValues?.length) template["headerValues"] = input.template.headerValues;
  if (input.template.bodyValues?.length) template["bodyValues"] = input.template.bodyValues;
  if (input.template.buttonValues) template["buttonValues"] = input.template.buttonValues;
  if (input.template.fileName) template["fileName"] = input.template.fileName;

  const body: Record<string, unknown> = {
    countryCode: phone.countryCode,
    phoneNumber: phone.phoneNumber,
    type: "Template",
    template,
  };
  if (input.callbackData) body["callbackData"] = input.callbackData.slice(0, 512);
  if (input.campaignId) body["campaignId"] = input.campaignId;

  return postMessage(cfg, body);
}

/**
 * Copy-code authentication template.
 * Sends the docs-minimal payload only (no callbackData / extra fields).
 * OTP must appear in bodyValues and buttonValues["0"].
 */
export async function sendAuthenticationOtp(phone: string, code: string, _callbackData?: string) {
  const cfg = interaktConfig();
  try {
    const body = buildAuthenticationOtpRequest({ phone, code });
    return postMessage(cfg, body as unknown as Record<string, unknown>);
  } catch (err) {
    return {
      accepted: false,
      reason: err instanceof Error ? err.message : "Invalid OTP request",
    } satisfies InteraktSendResult;
  }
}

export async function sendOrderConfirmation(input: {
  phone: string;
  customerName: string;
  orderNumber: string | number;
  orderTotal: string | number;
  callbackData?: string;
}) {
  const cfg = interaktConfig();
  if (!cfg.orderConfirmationApproved) {
    return {
      accepted: false,
      skipped: true,
      reason: "Order confirmation template not approved",
    } satisfies InteraktSendResult;
  }
  return sendTemplate({
    phone: input.phone,
    ...(input.callbackData ? { callbackData: input.callbackData } : {}),
    template: {
      name: cfg.orderConfirmationTemplate,
      languageCode: "en",
      bodyValues: [String(input.customerName), String(input.orderNumber), String(input.orderTotal)],
    },
  });
}

export async function sendOrderStatusUpdate(_input: {
  phone: string;
  templateName: string;
  bodyValues: string[];
  callbackData?: string;
}) {
  // Status templates are not approved yet — refuse to invent names.
  return {
    accepted: false,
    skipped: true,
    reason: "Order status templates not configured",
  } satisfies InteraktSendResult;
}

export async function sendMarketingTemplate(input: {
  phone: string;
  bodyValues?: string[];
  callbackData?: string;
}) {
  const cfg = interaktConfig();
  if (!cfg.marketingApproved) {
    return {
      accepted: false,
      skipped: true,
      reason: "Marketing template not approved",
    } satisfies InteraktSendResult;
  }
  return sendTemplate({
    phone: input.phone,
    ...(input.callbackData ? { callbackData: input.callbackData } : {}),
    template: {
      name: cfg.marketingTemplate,
      languageCode: "en",
      ...(input.bodyValues?.length ? { bodyValues: input.bodyValues } : {}),
    },
  });
}

export function interaktWebhookSignature(secret: string, rawBody: string | Buffer) {
  const payload = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  const hex = createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${hex}`;
}

export function verifyInteraktWebhookSignature(secret: string, rawBody: string | Buffer, header: string | null) {
  if (!secret || !header) return false;
  const expected = interaktWebhookSignature(secret, rawBody);
  const a = Buffer.from(expected);
  const b = Buffer.from(header.trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function mapInteraktWebhookType(type: string): InteraktDeliveryStatus | null {
  switch (type) {
    case "message_api_sent":
    case "message_campaign_sent":
      return "sent";
    case "message_api_delivered":
    case "message_campaign_delivered":
      return "delivered";
    case "message_api_read":
    case "message_campaign_read":
      return "read";
    case "message_api_failed":
    case "message_campaign_failed":
      return "failed";
    default:
      return null;
  }
}
