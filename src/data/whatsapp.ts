import { loadLocalEnv } from "./load-env";
import { interaktConfig, sendAuthenticationOtp } from "./interakt";

loadLocalEnv();

export type WhatsAppChannel = "whatsapp" | "dev";

/**
 * Deliver a customer OTP. Prefers Interakt when enabled; otherwise falls back to
 * Twilio / Meta Graph if configured. Never logs the OTP value.
 */
export async function sendWhatsAppOtp(phone: string, code: string): Promise<WhatsAppChannel> {
  const cfg = interaktConfig();
  if (cfg.enabled) {
    if (!cfg.apiKey) {
      throw new Error("WhatsApp is enabled but INTERAKT_API_KEY is missing.");
    }
    // No callbackData on auth OTP — keep the Interakt payload docs-minimal.
    const result = await sendAuthenticationOtp(phone, code);
    if (!result.accepted) {
      console.error("[grizzly-otp] Interakt send failed", {
        phone: phone.replace(/\d(?=\d{4})/g, "*"),
        reason: result.reason ?? "unknown",
      });
      throw new Error(result.reason || "Could not send the WhatsApp OTP.");
    }
    console.info("[grizzly-otp] Interakt accepted OTP send", {
      phone: phone.replace(/\d(?=\d{4})/g, "*"),
      providerMessageId: result.providerMessageId ?? null,
      note: "Check Interakt inbox / WhatsApp for Meta delivery (Error 100 = delivery-side)",
    });
    return "whatsapp";
  }

  const text = `Your Grizzly Pizzeria code expires in 5 minutes. Don't share it.`;
  const digits = phone.replace(/\D/g, "");
  const to = digits.length === 10 ? `91${digits}` : digits;

  const twilioSid = process.env["TWILIO_ACCOUNT_SID"]?.trim();
  const twilioToken = process.env["TWILIO_AUTH_TOKEN"]?.trim();
  const twilioFrom = process.env["TWILIO_WHATSAPP_FROM"]?.trim();
  if (twilioSid && twilioToken && twilioFrom) {
    const from = twilioFrom.startsWith("whatsapp:") ? twilioFrom : `whatsapp:${twilioFrom}`;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: from,
        To: `whatsapp:+${to}`,
        Body: `${text} Your code is ready in WhatsApp.`,
      }),
    });
    if (!res.ok) {
      throw new Error("WhatsApp send failed.");
    }
    return "whatsapp";
  }

  const token = process.env["WHATSAPP_TOKEN"]?.trim();
  const phoneId = process.env["WHATSAPP_PHONE_NUMBER_ID"]?.trim();
  const template = process.env["WHATSAPP_OTP_TEMPLATE"]?.trim() || "grizzly_otp";
  if (token && phoneId) {
    const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const templated = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: process.env["WHATSAPP_OTP_LANG"]?.trim() || "en" },
          components: [{ type: "body", parameters: [{ type: "text", text: code }] }],
        },
      }),
    });
    if (templated.ok) return "whatsapp";
    throw new Error("Could not send the WhatsApp OTP.");
  }

  // Local/dev without a provider: accept the challenge but do not print the code.
  console.info(`[grizzly-otp] WhatsApp provider not configured for ${phone.replace(/\d(?=\d{4})/g, "*")}`);
  return "dev";
}
