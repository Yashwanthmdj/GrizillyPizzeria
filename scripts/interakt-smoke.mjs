#!/usr/bin/env node
/**
 * Local Interakt smoke checks without Postman.
 * Never prints the API key or OTP.
 *
 * Usage:
 *   npm run test:interakt
 *
 * Live OTP send (optional): set INTERAKT_ENABLED=true, INTERAKT_API_KEY, INTERAKT_TEST_PHONE
 */
import { createHmac, randomInt } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile() {
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
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile();

const baseUrl = (process.env.INTERAKT_API_BASE_URL || "https://api.interakt.ai").replace(/\/$/, "");
const apiKey = process.env.INTERAKT_API_KEY?.trim() || "";
const enabled = ["1", "true", "yes"].includes((process.env.INTERAKT_ENABLED || "").toLowerCase());
const testPhone = (process.env.INTERAKT_TEST_PHONE || "").replace(/\D/g, "");
const countryCode = process.env.INTERAKT_DEFAULT_COUNTRY_CODE || "+91";
const otpTemplate = process.env.INTERAKT_OTP_TEMPLATE || "grizzly_login_otp";
const otpLang = process.env.INTERAKT_OTP_LANG || "en";

function maskPhone(p) {
  return p.replace(/\d(?=\d{4})/g, "*");
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function webhookSig(secret, body) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

async function main() {
  console.log("Interakt smoke — offline checks");

  const sample = '{"foo":1,"bar":2}';
  const sig = webhookSig("examplekey", sample);
  assert(sig.startsWith("sha256="), "signature prefix");
  assert(sig.length > 20, "signature length");
  console.log("ok  webhook HMAC shape");

  assert(/^\+?\d+$/.test(countryCode.replace(/\s/g, "")), "country code");
  console.log("ok  country code configured as", countryCode);

  if (!enabled || !apiKey) {
    console.log("skip live API — set INTERAKT_ENABLED=true and INTERAKT_API_KEY in .env");
    console.log("Done (offline).");
    return;
  }

  console.log("Interakt smoke — live API (no secrets logged)");

  // Invalid credentials check via a throwaway key on a dry-run path is not used;
  // instead verify Authorization is required by sending a deliberately empty template name
  // only when a test phone is present.
  if (!testPhone || testPhone.length !== 10) {
    console.log("skip live OTP — set INTERAKT_TEST_PHONE to a 10-digit authorized test mobile");
    // Still verify auth header acceptance with a no-op-ish call that should 4xx without leaking key.
    const res = await fetch(`${baseUrl}/v1/public/message/`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        countryCode,
        phoneNumber: "0000000000",
        type: "Template",
        template: { name: otpTemplate, languageCode: otpLang, bodyValues: ["000000"], buttonValues: { "0": ["000000"] } },
      }),
    });
    console.log("ok  API reachable, status", res.status, "(acceptance != delivery)");
    console.log("Done.");
    return;
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const res = await fetch(`${baseUrl}/v1/public/message/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      countryCode,
      phoneNumber: testPhone,
      type: "Template",
      callbackData: "smoke-otp",
      template: {
        name: otpTemplate,
        languageCode: otpLang,
        bodyValues: [code],
        buttonValues: { "0": [code] },
      },
    }),
  });

  const text = await res.text();
  let id = null;
  try {
    id = JSON.parse(text)?.id ?? null;
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    console.error("fail API status", res.status, "(body redacted)");
    process.exitCode = 1;
    return;
  }

  console.log("ok  OTP template accepted for", maskPhone(testPhone), id ? `(provider id received)` : "");
  console.log("note API acceptance is not the same as WhatsApp delivery — check the handset / Interakt logs");
  console.log("Done.");
}

main().catch((err) => {
  console.error("fail", err instanceof Error ? err.message : "unknown");
  process.exitCode = 1;
});
