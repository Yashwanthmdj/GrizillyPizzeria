import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

const key = process.env.INTERAKT_API_KEY?.trim();
const phone = (process.env.INTERAKT_TEST_PHONE || "").replace(/\D/g, "");
const base = (process.env.INTERAKT_API_BASE_URL || "https://api.interakt.ai").replace(/\/$/, "");
const templateName = process.env.INTERAKT_OTP_TEMPLATE || "grizzly_login_otp";
const code = "482193";

if (!key || phone.length !== 10) {
  console.error("Need INTERAKT_API_KEY and INTERAKT_TEST_PHONE in .env");
  process.exit(1);
}

const variants = [
  { label: "en+body+btn", languageCode: "en", bodyValues: [code], buttonValues: { "0": [code] } },
  { label: "en+body-only", languageCode: "en", bodyValues: [code] },
  { label: "en+btn-only", languageCode: "en", buttonValues: { "0": [code] } },
  { label: "en_US+body+btn", languageCode: "en_US", bodyValues: [code], buttonValues: { "0": [code] } },
];

for (const v of variants) {
  const template = { name: templateName, languageCode: v.languageCode };
  if (v.bodyValues) template.bodyValues = v.bodyValues;
  if (v.buttonValues) template.buttonValues = v.buttonValues;
  const res = await fetch(`${base}/v1/public/message/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      countryCode: "+91",
      phoneNumber: phone,
      type: "Template",
      template,
    }),
  });
  const text = await res.text();
  let msg = text.slice(0, 220);
  try {
    const j = JSON.parse(text);
    msg = j.message || j.error || JSON.stringify(j).slice(0, 220);
  } catch {
    /* keep text */
  }
  console.log(v.label, `status=${res.status}`, `msg=${String(msg).replace(/\d{6}/g, "******")}`);
}
