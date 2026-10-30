import margherita from "@/assets/menu-margherita.jpg";
import pepperoni from "@/assets/menu-pepperoni.jpg";
import veggie from "@/assets/menu-veggie.jpg";
import sides from "@/assets/menu-sides.jpg";
import drinks from "@/assets/menu-drinks.jpg";
import dessert from "@/assets/menu-dessert.jpg";
import combo from "@/assets/menu-combo.jpg";
import { rng } from "./rng";
import type {
  CartLine,
  Coupon,
  Customer,
  DB,
  MenuItem,
  Order,
  OrderStatus,
  Outlet,
  ShopSettings,
  Topping,
} from "./types";

export { rng };

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
    waitMinutes: 20,
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
    waitMinutes: 15,
    isOpen: true,
    pauseOrders: false,
  },
];

const SIZES = [
  { key: "Regular" as const, extra: 0 },
  { key: "Medium" as const, extra: 120 },
  { key: "Large" as const, extra: 240 },
];
const VEG_TOPS: Topping[] = [
  { name: "Extra cheese", price: 60, veg: true },
  { name: "Jalapeños", price: 40, veg: true },
  { name: "Mushrooms", price: 40, veg: true },
  { name: "Paneer", price: 60, veg: true },
  { name: "Olives", price: 40, veg: true },
];
const NV_TOPS: Topping[] = [
  ...VEG_TOPS,
  { name: "Pepperoni", price: 80, veg: false },
  { name: "Chicken tikka", price: 80, veg: false },
];

const both = { o1: true, o2: true };
function item(
  p: Partial<MenuItem> &
    Pick<MenuItem, "id" | "name" | "category" | "price" | "image" | "veg" | "description">,
): MenuItem {
  const pizza = p.category === "Pizzas";
  return {
    availability: { ...both },
    priceOverride: {},
    sizes: pizza ? SIZES : undefined,
    toppings: pizza ? (p.veg ? VEG_TOPS : NV_TOPS) : undefined,
    ...p,
  };
}

export const MENU: MenuItem[] = [
  item({
    id: "m1",
    name: "Classic Margherita",
    category: "Pizzas",
    veg: true,
    price: 249,
    image: margherita,
    badge: "Bestseller",
    description: "San Marzano tomato, fior di latte, fresh basil. Simple. Perfect.",
  }),
  item({
    id: "m2",
    name: "Grizzly Pepperoni",
    category: "Pizzas",
    veg: false,
    price: 379,
    image: pepperoni,
    badge: "Bestseller",
    description: "Double pepperoni, mozzarella, hot honey drizzle.",
  }),
  item({
    id: "m3",
    name: "Forest Veggie",
    category: "Pizzas",
    veg: true,
    price: 329,
    image: veggie,
    description: "Peppers, mushrooms, olives, onion and paneer cubes.",
  }),
  item({
    id: "m4",
    name: "Fire Bear",
    category: "Pizzas",
    veg: false,
    price: 399,
    image: pepperoni,
    badge: "Spicy",
    description: "Pepperoni, jalapeños, chilli flakes. Bring tissues.",
  }),
  item({
    id: "m5",
    name: "Paneer Tikka Roar",
    category: "Pizzas",
    veg: true,
    price: 349,
    image: veggie,
    badge: "Spicy",
    description: "Tandoori paneer, onion, capsicum, mint mayo swirl.",
  }),
  item({
    id: "m6",
    name: "Chicken Tikka Supreme",
    category: "Pizzas",
    veg: false,
    price: 419,
    image: pepperoni,
    description: "Smoky tikka chicken, onions, coriander, makhani base.",
  }),
  item({
    id: "m7",
    name: "Four Cheese Hibernation",
    category: "Pizzas",
    veg: true,
    price: 389,
    image: margherita,
    badge: "New",
    description: "Mozzarella, cheddar, parmesan, gouda. Nap afterwards.",
  }),
  item({
    id: "m8",
    name: "Honey Bear BBQ",
    category: "Pizzas",
    veg: false,
    price: 409,
    image: pepperoni,
    badge: "New",
    description: "BBQ chicken, red onion, honey glaze, smoked cheese.",
  }),
  item({
    id: "s1",
    name: "Cheesy Garlic Bread",
    category: "Sides",
    veg: true,
    price: 149,
    image: sides,
    badge: "Bestseller",
    description: "Buttery, garlicky, stretchy. With marinara dip.",
  }),
  item({
    id: "s2",
    name: "Stuffed Garlic Sticks",
    category: "Sides",
    veg: true,
    price: 179,
    image: sides,
    description: "Jalapeño and corn stuffed sticks.",
  }),
  item({
    id: "s3",
    name: "Peri Peri Fries",
    category: "Sides",
    veg: true,
    price: 129,
    image: combo,
    badge: "Spicy",
    description: "Crispy fries, peri peri dust.",
  }),
  item({
    id: "s4",
    name: "Chicken Wings (6)",
    category: "Sides",
    veg: false,
    price: 249,
    image: combo,
    description: "Smoky BBQ glazed wings.",
  }),
  item({
    id: "d1",
    name: "Classic Cola",
    category: "Drinks",
    veg: true,
    price: 69,
    image: drinks,
    description: "Ice cold. 330ml.",
  }),
  item({
    id: "d2",
    name: "Fresh Lime Soda",
    category: "Drinks",
    veg: true,
    price: 89,
    image: drinks,
    description: "Sweet, salted or both.",
  }),
  item({
    id: "d3",
    name: "Iced Peach Tea",
    category: "Drinks",
    veg: true,
    price: 99,
    image: drinks,
    badge: "New",
    description: "House brewed, lightly sweet.",
  }),
  item({
    id: "x1",
    name: "Choco Lava Cave",
    category: "Desserts",
    veg: true,
    price: 129,
    image: dessert,
    badge: "Bestseller",
    description: "Molten centre, vanilla scoop.",
  }),
  item({
    id: "x2",
    name: "Nutella Pizza Slice",
    category: "Desserts",
    veg: true,
    price: 159,
    image: dessert,
    description: "Sweet crust, Nutella, hazelnut crumble.",
  }),
  item({
    id: "c1",
    name: "Solo Bear Combo",
    category: "Combos",
    veg: true,
    price: 399,
    image: combo,
    description: "Regular Margherita + garlic bread + cola.",
  }),
  item({
    id: "c2",
    name: "Den Party Combo",
    category: "Combos",
    veg: false,
    price: 999,
    image: combo,
    badge: "Bestseller",
    description: "2 Medium pizzas + wings + fries + 2 drinks.",
  }),
  item({
    id: "c3",
    name: "Date Night Duo",
    category: "Combos",
    veg: true,
    price: 649,
    image: combo,
    description: "Medium pizza + garlic bread + 2 lava cakes.",
  }),
];
// A couple of sold-out examples
MENU[5]!.availability = { o1: true, o2: false };
MENU[10]!.availability = { o1: false, o2: true };

const NAMES = [
  "Aarav",
  "Diya",
  "Kabir",
  "Meera",
  "Rohan",
  "Ishita",
  "Arjun",
  "Sana",
  "Vihaan",
  "Anaya",
  "Zoya",
  "Dev",
];

export const DEFAULT_SETTINGS: ShopSettings = {
  taxPercent: 5,
  packagingFee: 20,
  minimumOrder: 149,
  defaultPrepMinutes: 20,
  phone: "9000000001",
  whatsapp: "9000000001",
  email: "hello@grizzlypizzeria.demo",
  refundText:
    "Placeholder text, to be replaced by the approved policy. Demo refunds are not processed.",
  cancellationText:
    "Placeholder text, to be replaced by the approved policy. Cancel before the kitchen accepts the order.",
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
      used: 3,
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
      used: 1,
      active: true,
    },
  ];
}

export function buildSeed(now = Date.now()): DB {
  const r = rng(42);
  const customers: Customer[] = NAMES.map((n, i) => ({
    phone: `98765${String(43210 + i).padStart(5, "0")}`,
    name: n,
    points: Math.floor(r() * 600),
    lifetimePoints: 600 + Math.floor(r() * 900),
    visits: 2 + Math.floor(r() * 14),
    streak: 1 + Math.floor(r() * 5),
    lastVisit: now - Math.floor(r() * 7) * 864e5,
    history: [
      { at: now - 6 * 864e5, delta: 45, label: "Order earned" },
      { at: now - 3 * 864e5, delta: -100, label: "Redeemed Rs 50 off" },
      { at: now - 864e5, delta: 60, label: "Order earned" },
    ],
  }));
  const orders: Order[] = [];
  let number = 101;
  for (let i = 0; i < 40; i++) {
    const outletId = r() > 0.5 ? "o1" : "o2";
    const c = customers[Math.floor(r() * customers.length)]!;
    const n = 1 + Math.floor(r() * 3);
    const lines: CartLine[] = [];
    for (let j = 0; j < n; j++) {
      const m = MENU[Math.floor(r() * MENU.length)]!;
      const qty = 1 + Math.floor(r() * 2);
      lines.push({
        key: `${m.id}-${j}`,
        itemId: m.id,
        name: m.name,
        image: m.image,
        veg: m.veg,
        size: m.sizes ? "Regular" : undefined,
        toppings: [],
        unitPrice: m.price,
        qty,
      });
    }
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const tax = Math.round(subtotal * 0.05);
    const total = subtotal + tax;
    // most recent 8 are live
    const ageMin = i < 8 ? 2 + i * 4 : 60 + i * 90;
    const createdAt = now - ageMin * 6e4;
    const liveStatus: OrderStatus[] = [
      "Placed",
      "Placed",
      "Accepted",
      "Preparing",
      "Preparing",
      "Ready",
      "Accepted",
      "Placed",
    ];
    const status: OrderStatus = i < 8 ? liveStatus[i]! : r() > 0.06 ? "Collected" : "Rejected";
    const online = r() > 0.4;
    const flowIdx = ["Placed", "Accepted", "Preparing", "Ready", "Collected"].indexOf(status);
    const history =
      status === "Rejected"
        ? [
            { status: "Placed" as const, at: createdAt },
            { status: "Rejected" as const, at: createdAt + 3e5 },
          ]
        : (["Placed", "Accepted", "Preparing", "Ready", "Collected"] as OrderStatus[])
            .slice(0, flowIdx + 1)
            .map((s, k) => ({ status: s, at: createdAt + k * 4e5 }));
    orders.push({
      id: `ord_${number}`,
      number: number++,
      outletId,
      customerName: c.name,
      phone: c.phone,
      lines,
      subtotal,
      tax,
      discount: 0,
      total,
      pointsUsed: 0,
      pointsEarned: Math.floor(total / 100) * 10,
      payment: online ? "online" : "counter",
      paid: online || status === "Collected",
      qrToken: online ? `tok${number}x${Math.floor(r() * 1e6)}` : undefined,
      qrUsed: status === "Collected",
      status,
      rejectReason: status === "Rejected" ? "Out of ingredients" : undefined,
      history,
      createdAt,
      promisedAt: createdAt + 20 * 6e4,
    });
  }
  return {
    version: 2,
    outlets: OUTLETS.map((o) => ({ ...o })),
    menu: MENU.map((m) => ({ ...m, availability: { ...m.availability }, priceOverride: {} })),
    orders: orders.reverse(),
    customers,
    coupons: defaultCoupons(now),
    settings: { ...DEFAULT_SETTINGS },
    audit: [],
    messages: [],
    loyalty: {
      pointsPerHundred: 10,
      steps: [
        { id: "r1", points: 100, label: "Rs 50 off", type: "discount", value: 50 },
        { id: "r2", points: 250, label: "Rs 150 off", type: "discount", value: 150 },
        { id: "r3", points: 500, label: "Free Medium pizza", type: "free-pizza", value: 369 },
      ],
      tiers: [
        { name: "Cub", min: 0 },
        { name: "Brown Bear", min: 500 },
        { name: "Grizzly", min: 1500 },
        { name: "Kodiak", min: 3000 },
      ],
    },
    staff: [
      { username: "kitchen.outlet1", name: "Outlet 1 Kitchen", role: "kitchen", outletId: "o1" },
      { username: "kitchen.outlet2", name: "Outlet 2 Kitchen", role: "kitchen", outletId: "o2" },
      { username: "owner", name: "The Owner", role: "owner" },
    ],
    nextNumber: number,
  };
}
