function e164In(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.startsWith("91") && d.length === 12) return d;
  return d;
}

export type WhatsAppChannel = "whatsapp" | "dev";

export async function sendWhatsAppOtp(phone: string, code: string): Promise<WhatsAppChannel> {
  const text = `Your Grizzly Pizzeria code is ${code}. It expires in 5 minutes. Don't share it.`;
  const to = e164In(phone);

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
        Body: text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body.slice(0, 180) || "WhatsApp send failed.");
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
    const plain = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text, preview_url: false },
      }),
    });
    if (!plain.ok) throw new Error("Could not send the WhatsApp OTP.");
    return "whatsapp";
  }

  console.info(`[grizzly-otp] WhatsApp API not configured. Code for ${phone}: ${code}`);
  return "dev";
}
