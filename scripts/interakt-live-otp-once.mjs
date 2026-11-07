import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomInt } from "node:crypto";

function loadEnv() {
  const file = resolve(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnv();

const phone = (process.argv[2] || "").replace(/\D/g, "");
if (phone.length !== 10) {
  console.error("Usage: node scripts/interakt-live-otp-once.mjs <10-digit-phone>");
  process.exit(1);
}

const apiKey = process.env.INTERAKT_API_KEY?.trim();
const baseUrl = (process.env.INTERAKT_API_BASE_URL || "https://api.interakt.ai").replace(/\/$/, "");
const templateName = process.env.INTERAKT_OTP_TEMPLATE || "grizzly_login_otp";
const languageCode = process.env.INTERAKT_OTP_LANG || "en";
const countryCode = process.env.INTERAKT_DEFAULT_COUNTRY_CODE || "+91";

if (!apiKey) {
  console.error("INTERAKT_API_KEY missing");
  process.exit(1);
}

const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
const body = {
  countryCode,
  phoneNumber: phone,
  type: "Template",
  template: {
    name: templateName,
    languageCode,
    bodyValues: [code],
    buttonValues: { "0": [code] },
  },
};

console.log("payload_shape", {
  topKeys: Object.keys(body).sort(),
  templateKeys: Object.keys(body.template).sort(),
  templateName,
  languageCode,
  countryCode,
  phoneMasked: `******${phone.slice(-4)}`,
  bodyValueCount: 1,
  button0Count: 1,
  hasCallbackData: false,
});

const res = await fetch(`${baseUrl}/v1/public/message/`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
let id = null;
let message = null;
let result = null;
try {
  const json = JSON.parse(text);
  id = json.id ?? null;
  message = json.message ?? null;
  result = json.result ?? null;
} catch {
  /* ignore */
}

console.log("http_status", res.status);
console.log("api_result", result);
console.log("provider_message_id", id);
console.log("interakt_message", message);
console.log(
  "note",
  "API acceptance != WhatsApp delivery. Check the handset and Interakt inbox for Meta Error 100.",
);
if (!res.ok) process.exitCode = 1;
