import { describe, expect, it } from "vitest";
import { evaluateScan, type ScanOrder } from "./scan";

const ready: ScanOrder = {
  id: "ord_1",
  number: 142,
  outletId: "o1",
  status: "Ready",
  qrToken: "abc",
  qrUsed: false,
};

describe("pickup QR", () => {
  it("accepts a matching token once, then blocks a reuse", () => {
    const raw = JSON.stringify({ id: "ord_1", o: "o1", t: "abc" });
    expect(evaluateScan([ready], raw, "o1").ok).toBe(true);
    const used = evaluateScan([{ ...ready, qrUsed: true }], raw, "o1");
    expect(used.ok).toBe(false);
    if (!used.ok) expect(used.reason).toMatch(/used/i);
  });

  it("rejects an invalid token and the wrong outlet", () => {
    const invalid = evaluateScan(
      [ready],
      JSON.stringify({ id: "ord_1", o: "o1", t: "nope" }),
      "o1",
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.reason).toMatch(/invalid/i);
    const wrong = evaluateScan([ready], JSON.stringify({ id: "ord_1", o: "o1", t: "abc" }), "o2");
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toMatch(/outlet/i);
  });

  it("accepts a typed order number for a ready order", () => {
    expect(evaluateScan([ready], "142", "o1").ok).toBe(true);
  });
});
