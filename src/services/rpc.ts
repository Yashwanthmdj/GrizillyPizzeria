import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Period } from "@/services/analytics";
import type {
  Coupon,
  KitchenWorker,
  LoyaltyRule,
  MenuItem,
  OrderStatus,
  Outlet,
  PaymentMethod,
  Role,
  ShopSettings,
} from "@/services/types";

type AuthSession = {
  kind?: "staff" | "customer";
  username?: string;
  role?: Role;
  outletId?: string;
  staffName?: string;
  phone?: string;
  customerName?: string;
};

async function identities() {
  const { readIdentities } = await import("@/data/session");
  return readIdentities();
}

async function staffActor(): Promise<AuthSession | null> {
  const { staff } = await identities();
  return staff;
}

async function customerActor(): Promise<AuthSession | null> {
  const { customer } = await identities();
  return customer;
}

export const getShopFn = createServerFn({ method: "GET" }).handler(async () => {
  const { snapshot } = await import("@/data/repo");
  return snapshot(await identities());
});

export const getAuthFn = createServerFn({ method: "GET" }).handler(async () => {
  const { customer, staff } = await identities();
  return {
    staff: staff
      ? {
          username: staff.username!,
          name: staff.staffName ?? staff.username!,
          role: staff.role!,
          outletId: staff.outletId,
        }
      : null,
    phone: customer?.phone ?? null,
    customerName: customer?.customerName ?? null,
  };
});

export const staffLoginFn = createServerFn({ method: "POST" })
  .validator(z.object({ username: z.string().min(1), password: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { staffLogin } = await import("@/data/repo");
    const { staffAuth } = await import("@/data/session");
    const staff = await staffLogin(data.username, data.password);
    const session = await staffAuth();
    await session.clear();
    await session.update({
      kind: "staff",
      username: staff.username,
      role: staff.role,
      staffName: staff.name,
      ...(staff.outletId ? { outletId: staff.outletId } : {}),
    });
    return staff;
  });

export const staffLogoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { staffAuth } = await import("@/data/session");
  const session = await staffAuth();
  await session.clear();
  return { ok: true };
});

async function startCustomerSession(user: { phone: string; name: string; username?: string }) {
  const { customerAuth } = await import("@/data/session");
  const session = await customerAuth();
  await session.clear();
  await session.update({
    kind: "customer",
    phone: user.phone,
    customerName: user.name,
    ...(user.username ? { username: user.username } : {}),
  });
  return user;
}

export const customerPasswordLoginFn = createServerFn({ method: "POST" })
  .validator(z.object({ username: z.string().min(1), password: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { customerPasswordLogin } = await import("@/data/repo");
    return startCustomerSession(await customerPasswordLogin(data));
  });

export const requestCustomerOtpFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      username: z.string().min(1),
      phone: z.string().optional(),
      password: z.string().optional(),
      intent: z.enum(["register", "reset"]),
    }),
  )
  .handler(async ({ data }) => {
    const { requestCustomerOtp } = await import("@/data/repo");
    return requestCustomerOtp(data);
  });

export const requestPhoneLoginOtpFn = createServerFn({ method: "POST" })
  .validator(z.object({ phone: z.string().min(10).max(15) }))
  .handler(async ({ data }) => {
    const { requestPhoneLoginOtp } = await import("@/data/repo");
    return requestPhoneLoginOtp(data);
  });

export const verifyCustomerOtpFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      phone: z.string().min(10),
      code: z.string().min(6).max(6),
      newPassword: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { verifyCustomerOtp } = await import("@/data/repo");
    return startCustomerSession(await verifyCustomerOtp(data));
  });

export const setMarketingConsentFn = createServerFn({ method: "POST" })
  .validator(z.object({ consented: z.boolean(), source: z.string().min(1).max(64) }))
  .handler(async ({ data }) => {
    const auth = await customerActor();
    if (!auth?.phone) throw new Error("Sign in first.");
    const { setMarketingConsent } = await import("@/data/whatsapp-outbox");
    await setMarketingConsent(auth.phone, data.consented, data.source);
    return { ok: true };
  });

export const sendMarketingCampaignFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      phone: z.string().min(10),
      campaignKey: z.string().min(1).max(64),
      bodyValues: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const auth = await staffActor();
    if (!auth || auth.role !== "owner") throw new Error("Owner access only.");
    const { enqueueMarketingIfConsented } = await import("@/data/whatsapp-outbox");
    return enqueueMarketingIfConsented({
      phone: data.phone,
      campaignKey: data.campaignKey,
      ...(data.bodyValues ? { bodyValues: data.bodyValues } : {}),
    });
  });

export const customerLogoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { customerAuth } = await import("@/data/session");
  const session = await customerAuth();
  await session.clear();
  return { ok: true };
});

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string(), email: z.string() }))
  .handler(async ({ data }) => {
    const { updateProfile } = await import("@/data/repo");
    const { customerAuth } = await import("@/data/session");
    const next = await updateProfile(await customerActor(), data);
    const session = await customerAuth();
    await session.update({ customerName: next.name });
    return next;
  });

const cartLineSchema = z.object({
  key: z.string(),
  lineId: z.string(),
  itemId: z.string(),
  name: z.string(),
  image: z.string(),
  veg: z.boolean(),
  size: z.enum(["Regular", "Small", "Medium", "Large"]).optional(),
  toppings: z.array(z.string()),
  note: z.string().optional(),
  unitPrice: z.number(),
  qty: z.number(),
  prepMinutes: z.number(),
  lineStatus: z.enum(["queued", "preparing", "ready", "collected"]),
  startedAt: z.number().optional(),
  readyAt: z.number().optional(),
  collectedAt: z.number().optional(),
  etaAt: z.number().optional(),
});

export const placeOrderFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      payment: z.enum(["online", "counter"]),
      name: z.string(),
      notes: z.string().optional(),
      scheduledFor: z.number().optional(),
      cart: z.array(cartLineSchema),
      outletId: z.string().nullable(),
      redeemStepId: z.string().nullable(),
      couponCode: z.string().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const { placeOrder } = await import("@/data/repo");
    const { notes, scheduledFor, ...rest } = data;
    return placeOrder(await customerActor(), {
      ...rest,
      ...(notes ? { notes } : {}),
      ...(scheduledFor ? { scheduledFor } : {}),
    });
  });

export const setOrderStatusFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      status: z.enum(["Placed", "Accepted", "Preparing", "Ready", "Collected", "Rejected"]),
      reason: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { setOrderStatus } = await import("@/data/repo");
    return setOrderStatus(await staffActor(), data.id, data.status as OrderStatus, data.reason);
  });

export const setLineReadyFn = createServerFn({ method: "POST" })
  .validator(z.object({ orderId: z.string(), lineId: z.string() }))
  .handler(async ({ data }) => {
    const { setLineReady } = await import("@/data/repo");
    return setLineReady(await staffActor(), data.orderId, data.lineId);
  });

export const verifyScanFn = createServerFn({ method: "POST" })
  .validator(z.object({ raw: z.string(), outletId: z.string() }))
  .handler(async ({ data }) => {
    const { collectPickup } = await import("@/data/repo");
    return collectPickup(await staffActor(), data.raw, data.outletId);
  });

export const confirmPickupFn = createServerFn({ method: "POST" })
  .validator(z.object({ orderId: z.string() }))
  .handler(async ({ data }) => {
    const { confirmPickup } = await import("@/data/repo");
    return confirmPickup(await staffActor(), data.orderId);
  });

export const updateOutletFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), patch: z.record(z.any()) }))
  .handler(async ({ data }) => {
    const { updateOutlet } = await import("@/data/repo");
    await updateOutlet(await staffActor(), data.id, data.patch as Partial<Outlet>);
    return { ok: true };
  });

export const upsertMenuItemFn = createServerFn({ method: "POST" })
  .validator(z.object({ item: z.any() }))
  .handler(async ({ data }) => {
    const { upsertMenuItem } = await import("@/data/repo");
    await upsertMenuItem(await staffActor(), data.item as MenuItem);
    return { ok: true };
  });

export const deleteMenuItemFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { deleteMenuItem } = await import("@/data/repo");
    await deleteMenuItem(await staffActor(), data.id);
    return { ok: true };
  });

export const updateLoyaltyFn = createServerFn({ method: "POST" })
  .validator(z.object({ rule: z.any() }))
  .handler(async ({ data }) => {
    const { updateLoyalty } = await import("@/data/repo");
    await updateLoyalty(await staffActor(), data.rule as LoyaltyRule);
    return { ok: true };
  });

export const saveCouponFn = createServerFn({ method: "POST" })
  .validator(z.object({ coupon: z.any() }))
  .handler(async ({ data }) => {
    const { saveCoupon } = await import("@/data/repo");
    await saveCoupon(await staffActor(), data.coupon as Coupon);
    return { ok: true };
  });

export const deleteCouponFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { deleteCoupon } = await import("@/data/repo");
    await deleteCoupon(await staffActor(), data.id);
    return { ok: true };
  });

export const updateSettingsFn = createServerFn({ method: "POST" })
  .validator(z.object({ settings: z.any() }))
  .handler(async ({ data }) => {
    const { updateSettings } = await import("@/data/repo");
    await updateSettings(await staffActor(), data.settings as ShopSettings);
    return { ok: true };
  });

export const adjustPointsFn = createServerFn({ method: "POST" })
  .validator(z.object({ phone: z.string(), delta: z.number(), reason: z.string() }))
  .handler(async ({ data }) => {
    const { adjustPoints } = await import("@/data/repo");
    await adjustPoints(await staffActor(), data.phone, data.delta, data.reason);
    return { ok: true };
  });

export const saveMessageFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string(),
      phone: z.string(),
      message: z.string(),
      outletId: z.string().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const { saveMessage } = await import("@/data/repo");
    return saveMessage(data);
  });

export const loadProductFn = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const { loadProduct } = await import("@/data/repo");
    return loadProduct(data.slug);
  });

export const getAnalyticsFn = createServerFn({ method: "GET" })
  .validator(
    z.object({
      outletId: z.string(),
      period: z.enum(["today", "week", "month", "year", "custom"]),
      from: z.number().optional(),
      to: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { getAnalytics } = await import("@/data/repo");
    const period: Period = data.period === "custom" ? "month" : data.period;
    return getAnalytics(await staffActor(), data.outletId, period, {
      ...(data.from ? { from: data.from } : {}),
      ...(data.to ? { to: data.to } : {}),
    });
  });

export const addWorkerFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      outletId: z.string(),
      name: z.string(),
      phone: z.string().optional(),
      role: z.enum(["cook", "counter"]),
    }),
  )
  .handler(async ({ data }) => {
    const { addWorker } = await import("@/data/repo");
    return addWorker(await staffActor(), {
      outletId: data.outletId,
      name: data.name,
      role: data.role,
      ...(data.phone ? { phone: data.phone } : {}),
    });
  });

export const setWorkerActiveFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), active: z.boolean() }))
  .handler(async ({ data }) => {
    const { setWorkerActive } = await import("@/data/repo");
    await setWorkerActive(await staffActor(), data.id, data.active);
    return { ok: true };
  });

export const clockWorkerFn = createServerFn({ method: "POST" })
  .validator(z.object({ workerId: z.string(), action: z.enum(["in", "out"]) }))
  .handler(async ({ data }) => {
    const { clockWorker } = await import("@/data/repo");
    return clockWorker(await staffActor(), data.workerId, data.action);
  });

export const setItemPrepFn = createServerFn({ method: "POST" })
  .validator(z.object({ itemId: z.string(), prepMinutes: z.number() }))
  .handler(async ({ data }) => {
    const { setItemPrep } = await import("@/data/repo");
    return setItemPrep(await staffActor(), data.itemId, data.prepMinutes);
  });

export const readyFn = createServerFn({ method: "GET" }).handler(async () => {
  const { snapshot } = await import("@/data/repo");
  const db = await snapshot(await identities());
  if (!db.menu) throw new Error("Store unavailable");
  return true;
});

export type { PaymentMethod };
