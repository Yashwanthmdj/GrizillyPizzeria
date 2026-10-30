export type ID = string;
export type Category = "Pizzas" | "Sides" | "Drinks" | "Desserts" | "Combos";
export const CATEGORIES: Category[] = ["Pizzas", "Sides", "Drinks", "Desserts", "Combos"];
export type SizeKey = "Regular" | "Medium" | "Large";

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
  waitMinutes: number;
  isOpen: boolean;
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
}

export interface CartLine {
  key: string;
  itemId: ID;
  name: string;
  image: string;
  veg: boolean;
  size?: SizeKey | undefined;
  toppings: string[];
  note?: string | undefined;
  unitPrice: number;
  qty: number;
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
  name: string;
  points: number;
  lifetimePoints: number;
  visits: number;
  streak: number;
  email?: string | undefined;
  lastVisit?: number | undefined;
  history: { at: number; delta: number; label: string }[];
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
  nextNumber: number;
}

export interface Session {
  outletId: ID | null;
  cart: CartLine[];
  phone: string | null;
  staff: Staff | null;
  myOrders: ID[];
  redeemStepId: ID | null;
  couponCode: string | null;
  kitchenOutlet?: ID | undefined;
}
