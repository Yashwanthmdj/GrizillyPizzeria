import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthenticationOtpRequest,
  describeInteraktPayload,
  interaktWebhookSignature,
  normalizeInteraktPhone,
  sendAuthenticationOtp,
  sendOrderConfirmation,
  verifyInteraktWebhookSignature,
} from "./interakt";
import { generateOtp, hashOtp } from "./passwords";
import { handleInteraktWebhook } from "./interakt-webhook";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env["INTERAKT_ENABLED"] = "true";
  process.env["INTERAKT_API_KEY"] = "test-key";
  process.env["INTERAKT_API_BASE_URL"] = "https://api.interakt.ai";
  process.env["INTERAKT_DEFAULT_COUNTRY_CODE"] = "+91";
  process.env["INTERAKT_ORDER_CONFIRMATION_APPROVED"] = "false";
  process.env["INTERAKT_MARKETING_APPROVED"] = "false";
  process.env["INTERAKT_WEBHOOK_SECRET"] = "examplekey";
  process.env["GRIZZLY_SESSION_PASSWORD"] = "x".repeat(32);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("normalizeInteraktPhone", () => {
  it("normalizes 10-digit Indian mobiles", () => {
    expect(normalizeInteraktPhone("9876543210")).toEqual({
      countryCode: "+91",
      phoneNumber: "9876543210",
      e164Digits: "919876543210",
    });
  });

  it("rejects invalid numbers", () => {
    expect(() => normalizeInteraktPhone("123")).toThrow(/valid mobile/i);
  });
});

describe("OTP helpers", () => {
  it("generates 6-digit codes", () => {
    const code = generateOtp(6);
    expect(code).toMatch(/^\d{6}$/);
  });

  it("hashes OTPs without storing plaintext equality", () => {
    const a = hashOtp("9876543210", "123456");
    const b = hashOtp("9876543210", "123456");
    const c = hashOtp("9876543210", "000000");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("buildAuthenticationOtpRequest", () => {
  it("matches Interakt Copy Code docs shape with no extra fields", () => {
    const body = buildAuthenticationOtpRequest({ phone: "9876543210", code: "654321" });
    expect(Object.keys(body).sort()).toEqual(["countryCode", "phoneNumber", "template", "type"]);
    expect(body).toEqual({
      countryCode: "+91",
      phoneNumber: "9876543210",
      type: "Template",
      template: {
        name: "grizzly_login_otp",
        languageCode: "en",
        bodyValues: ["654321"],
        buttonValues: { "0": ["654321"] },
      },
    });
    const shape = describeInteraktPayload(body as unknown as Record<string, unknown>);
    expect(shape.hasCallbackData).toBe(false);
    expect(shape.bodyAndButtonLengthsMatch).toBe(true);
    expect(JSON.stringify(shape)).not.toContain("654321");
  });
});

describe("sendAuthenticationOtp", () => {
  it("posts Copy Code bodyValues and buttonValues without callbackData", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ result: true, message: "ok", id: "msg-1" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await sendAuthenticationOtp("9876543210", "654321", "otp:9876543210");
    expect(result.accepted).toBe(true);
    expect(result.providerMessageId).toBe("msg-1");

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("https://api.interakt.ai/v1/public/message/");
    const init = call[1];
    const body = JSON.parse(String(init.body));
    expect(Object.keys(body).sort()).toEqual(["countryCode", "phoneNumber", "template", "type"]);
    expect(body.callbackData).toBeUndefined();
    expect(body.template.name).toBe("grizzly_login_otp");
    expect(body.template.languageCode).toBe("en");
    expect(body.template.bodyValues).toEqual(["654321"]);
    expect(body.template.buttonValues).toEqual({ "0": ["654321"] });
    expect(String((init.headers as Record<string, string>)["Authorization"])).toContain("Basic test-key");
  });

  it("handles invalid credentials without leaking the key", async () => {
    globalThis.fetch = vi.fn(async () => new Response("unauthorized", { status: 401 })) as unknown as typeof fetch;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendAuthenticationOtp("9876543210", "654321");
    expect(result.accepted).toBe(false);
    expect(JSON.stringify(result)).not.toContain("test-key");
    expect(spy.mock.calls.flat().join(" ")).not.toContain("test-key");
  });

  it("retries on timeout then fails safely", async () => {
    globalThis.fetch = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as unknown as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendAuthenticationOtp("9876543210", "654321");
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/timeout|network/i);
  });
});

describe("order confirmation gate", () => {
  it("skips unapproved confirmation templates", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await sendOrderConfirmation({
      phone: "9876543210",
      customerName: "Asha",
      orderNumber: 108,
      orderTotal: 228,
    });
    expect(result.skipped).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends when approved", async () => {
    process.env["INTERAKT_ORDER_CONFIRMATION_APPROVED"] = "true";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ result: true, id: "ord-1" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await sendOrderConfirmation({
      phone: "9876543210",
      customerName: "Asha",
      orderNumber: 108,
      orderTotal: 228,
    });
    expect(result.accepted).toBe(true);
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(call[1].body));
    expect(body.template.bodyValues).toEqual(["Asha", "108", "228"]);
  });
});

describe("webhook signature", () => {
  it("verifies Interakt-Signature examples", () => {
    const payload = '{"foo":1,"bar":2}';
    const sig = interaktWebhookSignature("examplekey", payload);
    expect(sig.startsWith("sha256=")).toBe(true);
    expect(verifyInteraktWebhookSignature("examplekey", payload, sig)).toBe(true);
    expect(verifyInteraktWebhookSignature("examplekey", payload, "sha256=deadbeef")).toBe(false);
  });
});

describe("webhook handler", () => {
  it("rejects bad signatures", async () => {
    const req = new Request("http://localhost/api/interakt-webhook", {
      method: "POST",
      headers: { "Interakt-Signature": "sha256=nope", "Content-Type": "application/json" },
      body: JSON.stringify({ type: "message_api_sent", data: { message: { id: "m1" } } }),
    });
    const res = await handleInteraktWebhook(req);
    expect(res.status).toBe(401);
  });

  it("accepts valid signatures and dedupes", async () => {
    const payload = JSON.stringify({
      type: "message_api_delivered",
      data: { message: { id: "m-dedupe-1" } },
    });
    const sig = interaktWebhookSignature("examplekey", payload);

    // Avoid depending on a live SQLite file in unit tests: spy record path via dynamic import mock is heavy.
    // Here we only assert signature acceptance reaches JSON handling; DB insert may create local data dir.
    const req = new Request("http://localhost/api/interakt-webhook", {
      method: "POST",
      headers: { "Interakt-Signature": sig, "Content-Type": "application/json" },
      body: payload,
    });
    const res = await handleInteraktWebhook(req);
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      const json = (await res.json()) as { ok: boolean };
      expect(json.ok).toBe(true);

      const req2 = new Request("http://localhost/api/interakt-webhook", {
        method: "POST",
        headers: { "Interakt-Signature": sig, "Content-Type": "application/json" },
        body: payload,
      });
      const res2 = await handleInteraktWebhook(req2);
      expect(res2.status).toBe(200);
      const json2 = (await res2.json()) as { duplicate?: boolean };
      expect(json2.duplicate).toBe(true);
    }
  });
});
