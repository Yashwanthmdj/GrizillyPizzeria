import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { useSession } from "@tanstack/react-start/server";
import { dataDir } from "./paths";
import type { Staff } from "@/services/types";

export type AuthSession = {
  kind?: "staff" | "customer";
  username?: string;
  role?: Staff["role"];
  outletId?: string;
  staffName?: string;
  phone?: string;
  customerName?: string;
};

const SECRET_FILE = "session.key";

function sessionPassword() {
  const fromEnv = process.env["GRIZZLY_SESSION_PASSWORD"]?.trim();
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  mkdirSync(dataDir(), { recursive: true });
  const file = path.join(dataDir(), SECRET_FILE);
  try {
    const existing = readFileSync(file, "utf8").trim();
    if (existing.length >= 32) return existing;
  } catch {
    /* first boot */
  }
  const generated = randomBytes(32).toString("hex");
  writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

const cookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env["NODE_ENV"] === "production",
  path: "/",
};

function options(name: string, maxAge: number) {
  return {
    name,
    password: sessionPassword(),
    maxAge,
    cookie,
  };
}

export async function customerAuth() {
  return useSession<AuthSession>(options("gp_customer", 60 * 60 * 24 * 30));
}

export async function staffAuth() {
  return useSession<AuthSession>(options("gp_staff", 60 * 60 * 12));
}

/** Previous single cookie — migrate once, then drop. */
async function legacyAuth() {
  return useSession<AuthSession>(options("gp_auth", 60 * 60 * 12));
}

export async function readIdentities(): Promise<{
  customer: AuthSession | null;
  staff: AuthSession | null;
}> {
  const customerSess = await customerAuth();
  const staffSess = await staffAuth();
  let customer = customerSess.data.kind === "customer" && customerSess.data.phone ? customerSess.data : null;
  let staff = staffSess.data.kind === "staff" && staffSess.data.username ? staffSess.data : null;
  if (!customer || !staff) {
    const legacy = await legacyAuth();
    if (!customer && legacy.data.kind === "customer" && legacy.data.phone) {
      await customerSess.update({ ...legacy.data, kind: "customer" });
      await legacy.clear();
      customer = customerSess.data;
    } else if (!staff && legacy.data.kind === "staff" && legacy.data.username) {
      await staffSess.update({ ...legacy.data, kind: "staff" });
      await legacy.clear();
      staff = staffSess.data;
    }
  }
  return { customer, staff };
}
