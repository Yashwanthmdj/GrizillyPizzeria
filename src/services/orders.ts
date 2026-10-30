import { STATUS_FLOW, type OrderStatus } from "./types";

/** Legal kitchen/owner moves. Reject is allowed until the order is collected. */
export function canTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) return false;
  if (to === "Rejected") return from !== "Collected" && from !== "Rejected";
  const i = STATUS_FLOW.indexOf(from);
  const j = STATUS_FLOW.indexOf(to);
  return i >= 0 && j === i + 1;
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  const options: OrderStatus[] = ["Accepted", "Preparing", "Ready", "Collected", "Rejected"];
  return options.filter((status) => canTransition(from, status));
}
