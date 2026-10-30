import { describe, expect, it } from "vitest";
import { canTransition, nextStatuses } from "./orders";

describe("order status", () => {
  it("only walks the pickup flow one step at a time", () => {
    expect(canTransition("Placed", "Accepted")).toBe(true);
    expect(canTransition("Accepted", "Preparing")).toBe(true);
    expect(canTransition("Preparing", "Ready")).toBe(true);
    expect(canTransition("Ready", "Collected")).toBe(true);
    expect(canTransition("Placed", "Ready")).toBe(false);
    expect(canTransition("Collected", "Preparing")).toBe(false);
  });

  it("allows a reject until the order has been collected", () => {
    expect(canTransition("Placed", "Rejected")).toBe(true);
    expect(canTransition("Ready", "Rejected")).toBe(true);
    expect(canTransition("Collected", "Rejected")).toBe(false);
    expect(nextStatuses("Preparing")).toEqual(["Ready", "Rejected"]);
  });
});
