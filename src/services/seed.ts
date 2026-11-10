import { menuPhotos as photo } from "./menu-photos";
import type {
  Coupon,
  DB,
  KitchenWorker,
  LoyaltyRule,
  MenuItem,
  Outlet,
  ShopSettings,
  Staff,
  Topping,
} from "./types";

export const OUTLETS: Outlet[] = [
  {
    id: "o1",
    name: "Grizzly Pizzeria - Outlet 1",
    short: "Outlet 1",
    address: "12, Kavuri Hills, Madhapur, Hyderabad",
    hours: "11:00 AM - 11:00 PM",
    openHour: 11,
    closeHour: 23,
    mapUrl: "https://maps.google.com/?q=Kavuri+Hills+Madhapur+Hyderabad",
    phone: "9000000001",
    waitMinutes: 10,
    minutesPerOrder: 10,
    fallbackWaitMinutes: 10,
    isOpen: true,
    pauseOrders: false,
  },
  {
    id: "o2",
    name: "Grizzly Pizzeria - Outlet 2",
    short: "Outlet 2",
    address: "48, Ayyappa Society, Madhapur, Hyderabad",
    hours: "12:00 PM - 12:00 AM",
    openHour: 12,
    closeHour: 24,
    mapUrl: "https://maps.google.com/?q=Ayyappa+Society+Madhapur+Hyderabad",
    phone: "9000000002",
    waitMinutes: 10,
    minutesPerOrder: 10,
    fallbackWaitMinutes: 10,
    isOpen: true,
    pauseOrders: false,
  },
];

const FRY_SIZES = [
  { key: "Small" as const, extra: 0 },
  { key: "Medium" as const, extra: 80 },
  { key: "Large" as const, extra: 170 },
];
const FRY_TOPS: Topping[] = [
  { name: "Nachos", price: 60, veg: true },
  { name: "Extra Cheese", price: 30, veg: true },
  { name: "Kurkure", price: 40, veg: true },
];

/** Only ingredients named in the item description become paid extras. */
const DESC_EXTRAS: { re: RegExp; topping: Topping }[] = [
  { re: /\b(mozzarella|cheese)\b/i, topping: { name: "Extra Cheese", price: 30, veg: true } },
  { re: /\bpaneer\b/i, topping: { name: "Extra Paneer", price: 50, veg: true } },
  { re: /\bmushroom\b/i, topping: { name: "Extra Mushroom", price: 40, veg: true } },
  { re: /\bjalapeno\b/i, topping: { name: "Extra Jalapeno", price: 25, veg: true } },
  { re: /\btomato\b/i, topping: { name: "Extra Tomato", price: 20, veg: true } },
  { re: /\bolives?\b/i, topping: { name: "Extra Olives", price: 30, veg: true } },
  { re: /\bonion\b/i, topping: { name: "Extra Onion", price: 20, veg: true } },
  { re: /\bcorn\b/i, topping: { name: "Extra Corn", price: 25, veg: true } },
  { re: /\b(pepper|paprika)\b/i, topping: { name: "Extra Pepper", price: 25, veg: true } },
  { re: /\bpesto\b/i, topping: { name: "Extra Pesto", price: 30, veg: true } },
  { re: /\bbasil\b/i, topping: { name: "Extra Basil", price: 15, veg: true } },
  { re: /\blettuce\b/i, topping: { name: "Extra Lettuce", price: 15, veg: true } },
  { re: /\bmayo\b/i, topping: { name: "Extra Garlic Mayo", price: 20, veg: true } },
  { re: /\bgarlic butter\b/i, topping: { name: "Extra Garlic Butter", price: 20, veg: true } },
  { re: /\bwhite sauce\b/i, topping: { name: "Extra White Sauce", price: 25, veg: true } },
  { re: /\bchutney\b/i, topping: { name: "Extra Chutney", price: 20, veg: true } },
];

const both = { o1: true, o2: true };

function defaultPrep(category: MenuItem["category"]) {
  if (category === "Fries") return 6;
  if (category === "Pizzas") return 16;
  if (category === "Folds") return 8;
  if (category === "Garlic Bread") return 8;
  if (category === "Dips") return 1;
  return 8;
}

/** Paid extras = ingredients listed in the description only (never invented from the name). */
function extrasFor(category: MenuItem["category"], description: string): Topping[] | undefined {
  if (category === "Dips") return undefined;
  if (category === "Fries") return FRY_TOPS;

  // Ignore "olive oil" so it does not become Extra Olives.
  const text = description.replace(/\bolive oil\b/gi, " ");
  const list: Topping[] = [];
  const seen = new Set<string>();
  for (const { re, topping } of DESC_EXTRAS) {
    if (!re.test(text) || seen.has(topping.name)) continue;
    seen.add(topping.name);
    list.push(topping);
  }
  return list.length ? list : undefined;
}

function item(
  p: Partial<MenuItem> &
    Pick<MenuItem, "id" | "name" | "category" | "price" | "image" | "veg" | "description">,
): MenuItem {
  const fries = p.category === "Fries";
  return {
    availability: { ...both },
    priceOverride: {},
    sizes: fries ? FRY_SIZES : undefined,
    toppings: extrasFor(p.category, p.description),
    prepMinutes: defaultPrep(p.category),
    ...p,
    veg: true,
  };
}

/** Printed Grizzly board only. Garlic bread had no prices on the card. */
export const MENU: MenuItem[] = [
  item({
    id: "p1",
    name: "Margherita",
    category: "Pizzas",
    veg: true,
    price: 259,
    image: photo.margherita,
    badge: "Bestseller",
    description: "Tomato sauce, mozzarella, basil and olive oil.",
  }),
  item({
    id: "p2",
    name: "Angry Mushroom",
    category: "Pizzas",
    veg: true,
    price: 289,
    image: photo.angryMushroomPizza,
    badge: "Spicy",
    description: "Tomato sauce, garlic-marinated mushroom and jalapeno.",
  }),
  item({
    id: "p3",
    name: "Pesto Olive",
    category: "Pizzas",
    veg: true,
    price: 299,
    image: photo.pestoPizza,
    description: "Pesto sauce, olives, peppers and sun-dried tomato.",
  }),
  item({
    id: "p4",
    name: "Devil",
    category: "Pizzas",
    veg: true,
    price: 299,
    image: photo.devil,
    badge: "Spicy",
    description: "Paneer, pickled onion, paprika and jalapeno.",
  }),
  item({
    id: "p5",
    name: "Bianca Al Truffle",
    category: "Pizzas",
    veg: true,
    price: 349,
    image: photo.bianca,
    description: "White sauce, caramelized onion and mushroom.",
  }),
  item({
    id: "p6",
    name: "Farmhouse",
    category: "Pizzas",
    veg: true,
    price: 299,
    image: photo.farmhouse,
    description: "Pepper, pickled onion, corn, jalapeno, olives and mushroom.",
  }),
  item({
    id: "sw1",
    name: "Classic Caprese Fold",
    category: "Folds",
    veg: true,
    price: 259,
    image: photo.capreseFold,
    description: "Fresh mozzarella cheese, lettuce, tomato and pesto sauce.",
  }),
  item({
    id: "sw2",
    name: "Funghi Krmusi Fold",
    category: "Folds",
    veg: true,
    price: 199,
    image: photo.funghiFold,
    description: "Marinated mushroom, jalapeno, lettuce and garlic mayo.",
  }),
  item({
    id: "sw3",
    name: "Paneer Tikka Fold",
    category: "Folds",
    veg: true,
    price: 249,
    image: photo.paneerFold,
    description: "Pickled onion, green chutney, paneer, tomato and lettuce.",
  }),
  item({
    id: "g1",
    name: "Classic Garlic Bread",
    category: "Garlic Bread",
    veg: true,
    price: 169,
    image: photo.classicBread,
    description: "Garlic butter.",
  }),
  item({
    id: "g2",
    name: "Grizzly Chef Special",
    category: "Garlic Bread",
    veg: true,
    price: 219,
    image: photo.chefBread,
    badge: "Bestseller",
    description: "Garlic butter, cheese and garlic mayo.",
  }),
  item({
    id: "g3",
    name: "Jalapeno & Tomato",
    category: "Garlic Bread",
    veg: true,
    price: 219,
    image: photo.jalapenoBread,
    badge: "Spicy",
    description: "Jalapeno, tomato, garlic butter and cheese.",
  }),
  item({
    id: "g4",
    name: "Angry Mushroom",
    category: "Garlic Bread",
    veg: true,
    price: 229,
    image: photo.mushroomBread,
    description: "Marinated mushroom and cheese.",
  }),
  item({
    id: "g5",
    name: "Pesto Garlic Bread",
    category: "Garlic Bread",
    veg: true,
    price: 259,
    image: photo.pestoBread,
    description: "Pesto sauce, garlic butter, cheese and sun-dried tomato.",
  }),
  item({
    id: "f0",
    name: "Salted Fries",
    category: "Fries",
    veg: true,
    price: 99,
    image: photo.saltedFries,
    description: "Classic salted crispy fries. Small / Medium / Large.",
  }),
  item({
    id: "f1",
    name: "Spicy Chipotle Fries",
    category: "Fries",
    veg: true,
    price: 99,
    image: photo.chipotleFries,
    badge: "Bestseller",
    description: "Crispy fries, spicy chipotle dust. Small / Medium / Large.",
  }),
  item({
    id: "f2",
    name: "Chilli Cheese Fries",
    category: "Fries",
    veg: true,
    price: 99,
    image: photo.chilliCheeseFries,
    badge: "Bestseller",
    description: "Crispy fries, chilli cheese. Small / Medium / Large.",
  }),
  item({
    id: "f5",
    name: "Peri Peri Fries",
    category: "Fries",
    veg: true,
    price: 99,
    image: photo.periPeriFries,
    badge: "Spicy",
    description: "Crispy fries, peri peri seasoning. Small / Medium / Large.",
  }),
  item({
    id: "f3",
    name: "Cheese Peri Peri Fries",
    category: "Fries",
    veg: true,
    price: 99,
    image: photo.cheesePeriPeriFries,
    badge: "Bestseller",
    description: "Crispy fries, cheese peri peri. Small / Medium / Large.",
  }),
  item({
    id: "f4",
    name: "Korean BBQ Fries",
    category: "Fries",
    veg: true,
    price: 99,
    image: photo.koreanFries,
    badge: "Bestseller",
    description: "Crispy fries, Korean BBQ. Small / Medium / Large.",
  }),
  item({
    id: "dip1",
    name: "Pesto Dip",
    category: "Dips",
    veg: true,
    price: 40,
    image: photo.pestoDip,
    description: "House pesto.",
  }),
  item({
    id: "dip2",
    name: "Honey Chilli Dip",
    category: "Dips",
    veg: true,
    price: 39,
    image: photo.honeyChilliDip,
    description: "Sweet heat.",
  }),
  item({
    id: "dip3",
    name: "Marinara Dip",
    category: "Dips",
    veg: true,
    price: 35,
    image: photo.marinaraDip,
    description: "Classic tomato.",
  }),
  item({
    id: "dip4",
    name: "Ranch Dip",
    category: "Dips",
    veg: true,
    price: 35,
    image: photo.ranchDip,
    description: "Creamy ranch.",
  }),
];

export const DEFAULT_SETTINGS: ShopSettings = {
  taxPercent: 5,
  packagingFee: 20,
  minimumOrder: 99,
  defaultPrepMinutes: 10,
  phone: "9000000001",
  whatsapp: "9000000001",
  email: "hello@grizzlypizzeria.com",
  refundText:
    "If the kitchen cannot fulfil an accepted order, we refund online payments to the original method within 3–5 working days. Counter payments are not charged until pickup.",
  cancellationText:
    "Cancel from My orders before the kitchen accepts. After accept, call the outlet — food already in the oven cannot be cancelled.",
  zomatoUrl: "",
  swiggyUrl: "",
};

export function defaultCoupons(now = Date.now()): Coupon[] {
  return [
    {
      id: "cp1",
      code: "BEAR50",
      type: "flat",
      value: 50,
      minOrder: 399,
      validFrom: now - 864e5,
      validUntil: now + 90 * 864e5,
      usageLimit: 100,
      used: 0,
      active: true,
    },
    {
      id: "cp2",
      code: "SLICE10",
      type: "percent",
      value: 10,
      minOrder: 299,
      validFrom: now - 864e5,
      validUntil: now + 30 * 864e5,
      usageLimit: 50,
      used: 0,
      active: true,
    },
  ];
}

export const DEFAULT_LOYALTY: LoyaltyRule = {
  pointsPerHundred: 10,
  steps: [
    { id: "r1", points: 100, label: "Rs 50 off", type: "discount", value: 50 },
    { id: "r2", points: 250, label: "Rs 150 off", type: "discount", value: 150 },
    { id: "r3", points: 500, label: "Free Margherita", type: "free-pizza", value: 259 },
  ],
  tiers: [
    { name: "Cub", min: 0 },
    { name: "Brown Bear", min: 500 },
    { name: "Grizzly", min: 1500 },
    { name: "Kodiak", min: 3000 },
  ],
};

export const DEFAULT_STAFF: Staff[] = [
  { username: "kitchen.outlet1", name: "Outlet 1 Kitchen", role: "kitchen", outletId: "o1" },
  { username: "kitchen.outlet2", name: "Outlet 2 Kitchen", role: "kitchen", outletId: "o2" },
  { username: "owner", name: "Owner", role: "owner" },
];

export function defaultWorkers(): KitchenWorker[] {
  return [
    { id: "w1", outletId: "o1", name: "Ravi", role: "cook", active: true },
    { id: "w2", outletId: "o1", name: "Sneha", role: "cook", active: true },
    { id: "w3", outletId: "o1", name: "Imran", role: "counter", active: true },
    { id: "w4", outletId: "o2", name: "Anu", role: "cook", active: true },
    { id: "w5", outletId: "o2", name: "Vikram", role: "cook", active: true },
    { id: "w6", outletId: "o2", name: "Leela", role: "counter", active: true },
  ];
}

export function emptyCatalog(now = Date.now()): DB {
  return {
    version: 3,
    outlets: OUTLETS.map((o) => ({ ...o })),
    menu: MENU.map((m) => ({ ...m, availability: { ...m.availability }, priceOverride: {} })),
    orders: [],
    customers: [],
    coupons: defaultCoupons(now),
    settings: { ...DEFAULT_SETTINGS },
    audit: [],
    messages: [],
    loyalty: { ...DEFAULT_LOYALTY, steps: DEFAULT_LOYALTY.steps.map((s) => ({ ...s })) },
    staff: DEFAULT_STAFF.map((s) => ({ ...s })),
    workers: defaultWorkers(),
    attendance: [],
    nextNumber: 101,
  };
}

/** Catalog-only seed. Live orders and customers live in SQLite. */
export function buildSeed(now = Date.now()): DB {
  return emptyCatalog(now);
}
