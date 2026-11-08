import margherita from "@/assets/menu-margherita.webp";
import angryMushroom from "@/assets/menu-angry-mushroom.webp";
import pestoOlive from "@/assets/menu-pesto-olive.webp";
import devil from "@/assets/menu-devil.webp";
import biancaAlTruffle from "@/assets/menu-bianca-al-truffle.webp";
import farmhouse from "@/assets/menu-farmhouse.webp";
import sides from "@/assets/menu-sides.jpg";
import drinks from "@/assets/menu-drinks.jpg";
import combo from "@/assets/menu-combo.jpg";
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

const both = { o1: true, o2: true };

function defaultPrep(category: MenuItem["category"]) {
  if (category === "Fries") return 6;
  if (category === "Pizzas") return 16;
  if (category === "Folds") return 8;
  if (category === "Garlic Bread") return 8;
  if (category === "Dips") return 1;
  return 8;
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
    toppings: fries ? FRY_TOPS : undefined,
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
    image: margherita,
    badge: "Bestseller",
    description: "Tomato sauce, mozzarella, basil and olive oil.",
  }),
  item({
    id: "p2",
    name: "Angry Mushroom",
    category: "Pizzas",
    veg: true,
    price: 289,
    image: angryMushroom,
    badge: "Spicy",
    description: "Tomato sauce, garlic-marinated mushroom and jalapeno.",
  }),
  item({
    id: "p3",
    name: "Pesto Olive",
    category: "Pizzas",
    veg: true,
    price: 299,
    image: pestoOlive,
    description: "Pesto sauce, olives, peppers and sun-dried tomato.",
  }),
  item({
    id: "p4",
    name: "Devil",
    category: "Pizzas",
    veg: true,
    price: 299,
    image: devil,
    badge: "Spicy",
    description: "Paneer, pickled onion, paprika and jalapeno.",
  }),
  item({
    id: "p5",
    name: "Bianca Al Truffle",
    category: "Pizzas",
    veg: true,
    price: 349,
    image: biancaAlTruffle,
    description: "White sauce, caramelized onion and mushroom.",
  }),
  item({
    id: "p6",
    name: "Farmhouse",
    category: "Pizzas",
    veg: true,
    price: 299,
    image: farmhouse,
    description: "Pepper, pickled onion, corn, jalapeno, olives and mushroom.",
  }),
  item({
    id: "sw1",
    name: "Classic Caprese Fold",
    category: "Folds",
    veg: true,
    price: 259,
    image: sides,
    description: "Fresh mozzarella cheese, lettuce, tomato and pesto sauce.",
  }),
  item({
    id: "sw2",
    name: "Funghi Krmusi Fold",
    category: "Folds",
    veg: true,
    price: 199,
    image: sides,
    description: "Marinated mushroom, jalapeno, lettuce and garlic mayo.",
  }),
  item({
    id: "sw3",
    name: "Paneer Tikka Fold",
    category: "Folds",
    veg: true,
    price: 249,
    image: sides,
    description: "Pickled onion, green chutney, paneer, tomato and lettuce.",
  }),
  item({
    id: "g1",
    name: "Classic Garlic Bread",
    category: "Garlic Bread",
    veg: true,
    price: 169,
    image: sides,
    description: "Garlic butter.",
  }),
  item({
    id: "g2",
    name: "Grizzly Chef Special",
    category: "Garlic Bread",
    veg: true,
    price: 219,
    image: sides,
    badge: "Bestseller",
    description: "Garlic butter, cheese and garlic mayo.",
  }),
  item({
    id: "g3",
    name: "Jalapeno & Tomato",
    category: "Garlic Bread",
    veg: true,
    price: 219,
    image: sides,
    badge: "Spicy",
    description: "Jalapeno, garlic butter and cheese.",
  }),
  item({
    id: "g4",
    name: "Angry Mushroom",
    category: "Garlic Bread",
    veg: true,
    price: 229,
    image: sides,
    description: "Marinated mushroom and cheese.",
  }),
  item({
    id: "g5",
    name: "Pesto Garlic Bread",
    category: "Garlic Bread",
    veg: true,
    price: 259,
    image: sides,
    description: "Pesto sauce, garlic butter, cheese and sun-dried tomato.",
  }),
  item({
    id: "f0",
    name: "Salted Fries",
    category: "Fries",
    veg: true,
    price: 99,
    image: combo,
    description: "Classic salted crispy fries. Small / Medium / Large.",
  }),
  item({
    id: "f1",
    name: "Spicy Chipotle Fries",
    category: "Fries",
    veg: true,
    price: 99,
    image: combo,
    badge: "Bestseller",
    description: "Crispy fries, spicy chipotle dust. Small / Medium / Large.",
  }),
  item({
    id: "f2",
    name: "Chilli Cheese Fries",
    category: "Fries",
    veg: true,
    price: 99,
    image: combo,
    badge: "Bestseller",
    description: "Crispy fries, chilli cheese. Small / Medium / Large.",
  }),
  item({
    id: "f3",
    name: "Cheese Peri Peri Fries",
    category: "Fries",
    veg: true,
    price: 99,
    image: combo,
    badge: "Bestseller",
    description: "Crispy fries, cheese peri peri. Small / Medium / Large.",
  }),
  item({
    id: "f4",
    name: "Korean BBQ Fries",
    category: "Fries",
    veg: true,
    price: 99,
    image: combo,
    badge: "Bestseller",
    description: "Crispy fries, Korean BBQ. Small / Medium / Large.",
  }),
  item({
    id: "dip1",
    name: "Pesto Dip",
    category: "Dips",
    veg: true,
    price: 40,
    image: drinks,
    description: "House pesto.",
  }),
  item({
    id: "dip2",
    name: "Honey Chilli Dip",
    category: "Dips",
    veg: true,
    price: 39,
    image: drinks,
    description: "Sweet heat.",
  }),
  item({
    id: "dip3",
    name: "Marinara Dip",
    category: "Dips",
    veg: true,
    price: 35,
    image: drinks,
    description: "Classic tomato.",
  }),
  item({
    id: "dip4",
    name: "Ranch Dip",
    category: "Dips",
    veg: true,
    price: 35,
    image: drinks,
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
