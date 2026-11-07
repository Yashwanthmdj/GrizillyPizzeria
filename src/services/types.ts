export type ID = string;
export type Category = "Pizzas" | "Sandwiches" | "Garlic Bread" | "Fries" | "Dips";
export const CATEGORIES: Category[] = ["Pizzas", "Sandwiches", "Garlic Bread", "Fries", "Dips"];
export type SizeKey = "Regular" | "Small" | "Medium" | "Large";

export interface Outlet {
  id: ID;
  name: string;
  short: string;
  address: string;
  hours: string;
  openHour: number;
  closeHour: number;
  mapUrl: string;
  phone: string;
  /** Live pickup estimate for the next customer (queue × minutes per order). */
  waitMinutes: number;
  /** Kitchen-set minutes for one order. */
  minutesPerOrder?: number | undefined;
  fallbackWaitMinutes?: number | undefined;
  queueLength?: number | undefined;
  cooksOnFloor?: number | undefined;
  isOpen: boolean;
  /** Kitchen/owner override — stay open outside printed hours. */
  forceOpen?: boolean | undefined;
  pauseOrders: boolean;
}

export interface Topping {
  name: string;
  price: number;
  veg: boolean;
}

export interface MenuItem {
  id: ID;
  name: string;
  description: string;
  category: Category;
  veg: boolean;
  price: number; // base (Regular)
  image: string;
  badge?: "Bestseller" | "Spicy" | "New" | undefined;
  sizes?: { key: SizeKey; extra: number }[] | undefined;
  toppings?: Topping[] | undefined;
  availability: Record<ID, boolean>;
  priceOverride: Record<ID, number | undefined>;
  /** Kept on the item record; wait is order-queue × minutesPerOrder, not per item. */
  prepMinutes: number;
}

export type LineStatus = "queued" | "preparing" | "ready" | "collected";

export interface CartLine {
  key: string;
  lineId: string;
  itemId: ID;
  name: string;
  image: string;
  veg: boolean;
  size?: SizeKey | undefined;
  toppings: string[];
  note?: string | undefined;
  unitPrice: number;
  qty: number;
  prepMinutes: number;
  lineStatus: LineStatus;
  startedAt?: number | undefined;
  readyAt?: number | undefined;
  collectedAt?: number | undefined;
  etaAt?: number | undefined;
}

export type OrderStatus = "Placed" | "Accepted" | "Preparing" | "Ready" | "Collected" | "Rejected";
export const STATUS_FLOW: OrderStatus[] = ["Placed", "Accepted", "Preparing", "Ready", "Collected"];
export type PaymentMethod = "online" | "counter";

export interface Order {
  id: ID;
  number: number;
  outletId: ID;
  customerName: string;
  phone: string;
  lines: CartLine[];
  subtotal: number;
  tax: number;
  discount: number;
  couponCode?: string | undefined;
  couponDiscount?: number | undefined;
  packaging?: number | undefined;
  total: number;
  pointsUsed: number;
  pointsEarned: number;
  payment: PaymentMethod;
  paid: boolean;
  qrToken?: string | undefined;
  qrUsed?: boolean | undefined;
  waitMinutes?: number | undefined;
  status: OrderStatus;
  history: { status: OrderStatus; at: number }[];
  rejectReason?: string | undefined;
  createdAt: number;
  promisedAt: number;
  scheduledFor?: number | undefined;
  notes?: string | undefined;
}

export interface Customer {
  phone: string;
  username?: string | undefined;
  name: string;
  points: number;
  lifetimePoints: number;
  visits: number;
  streak: number;
  email?: string | undefined;
  lastVisit?: number | undefined;
  history: { at: number; delta: number; label: string }[];
  /** Opt-in for WhatsApp marketing templates (transactional OTP/orders are separate). */
  waMarketingConsent?: boolean | undefined;
  waMarketingConsentAt?: number | undefined;
  waMarketingConsentSource?: string | undefined;
}

export type WorkerRole = "cook" | "counter";

export interface KitchenWorker {
  id: ID;
  outletId: ID;
  name: string;
  phone?: string | undefined;
  role: WorkerRole;
  active: boolean;
}

export interface AttendanceRecord {
  id: ID;
  workerId: ID;
  outletId: ID;
  workerName: string;
  clockIn: number;
  clockOut?: number | undefined;
}

export interface RewardStep {
  id: ID;
  points: number;
  label: string;
  type: "discount" | "free-pizza";
  value: number; // Rs off for discount
}

export interface LoyaltyRule {
  pointsPerHundred: number; // points per Rs 100 spent
  steps: RewardStep[];
  tiers: { name: string; min: number }[];
}

export interface Coupon {
  id: ID;
  code: string;
  type: "percent" | "flat";
  value: number;
  minOrder: number;
  validFrom: number;
  validUntil: number;
  usageLimit: number;
  used: number;
  active: boolean;
}

export interface ShopSettings {
  taxPercent: number;
  packagingFee: number;
  minimumOrder: number;
  defaultPrepMinutes: number;
  phone: string;
  whatsapp: string;
  email: string;
  refundText: string;
  cancellationText: string;
}

export interface AuditEntry {
  id: ID;
  at: number;
  actor: string;
  action: string;
  detail: string;
}

export interface ContactMessage {
  id: ID;
  name: string;
  phone: string;
  message: string;
  outletId: string | null;
  at: number;
}

export type Role = "kitchen" | "owner";
export interface Staff {
  username: string;
  name: string;
  role: Role;
  outletId?: ID | undefined;
}

export interface DB {
  version: number;
  outlets: Outlet[];
  menu: MenuItem[];
  orders: Order[];
  customers: Customer[];
  loyalty: LoyaltyRule;
  coupons: Coupon[];
  settings: ShopSettings;
  audit: AuditEntry[];
  messages: ContactMessage[];
  staff: Staff[];
  workers: KitchenWorker[];
  attendance: AttendanceRecord[];
  nextNumber: number;
}

export interface Session {
  outletId: ID | null;
  cart: CartLine[];
  phone: string | null;
  customerName: string | null;
  staff: Staff | null;
  myOrders: ID[];
  redeemStepId: ID | null;
  couponCode: string | null;
  kitchenOutlet?: ID | undefined;
}
