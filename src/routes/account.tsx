import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BearMark } from "@/components/brand";
import { PageHead, ShopLayout, seo } from "@/components/shop/ShopLayout";
import { sendOtp, signOutCustomer, updateProfile, verifyOtp } from "@/services/api";
import { tierFor } from "@/services/pricing";
import { useDB, useSession } from "@/services/store";

export const Route = createFileRoute("/account")({
  head: () =>
    seo(
      "Account · Grizzly Pizzeria",
      "Your Grizzly Pizzeria profile, saved details and loyalty.",
      "/account",
    ),
  component: AccountPage,
});

function AccountPage() {
  const db = useDB();
  const s = useSession();
  const me = db.customers.find((c) => c.phone === s.phone);
  if (!s.phone || !me) return <SignIn />;
  return (
    <Profile
      name={me.name}
      email={me.email ?? ""}
      phone={me.phone}
      points={me.points}
      visits={me.visits}
      tier={tierFor(me.lifetimePoints, db.loyalty).current?.name ?? "Cub"}
    />
  );
}

function SignIn() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <ShopLayout>
      <PageHead title="Your account" sub="Demo sign-in. The code is always 1234." />
      <form
        className="mx-auto max-w-md space-y-3 px-4 py-10"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (!sent) {
              if (phone.length !== 10 || !name.trim())
                throw new Error("Enter your name and a 10-digit phone.");
              const result = await sendOtp(phone);
              setSent(true);
              toast(result.hint);
            } else {
              await verifyOtp(phone, otp, name);
              toast.success("Signed in");
            }
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-sm font-semibold">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border-2 border-input bg-card px-3"
          />
        </label>
        <label className="block text-sm font-semibold">
          Phone
          <input
            value={phone}
            inputMode="numeric"
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="mt-1 h-11 w-full rounded-xl border-2 border-input bg-card px-3"
          />
        </label>
        {sent && (
          <label className="block text-sm font-semibold">
            OTP
            <input
              value={otp}
              inputMode="numeric"
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="mt-1 h-11 w-full rounded-xl border-2 border-input bg-card px-3"
            />
          </label>
        )}
        {error && (
          <p className="text-sm font-semibold text-primary" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {sent ? "Verify and sign in" : "Send demo OTP"}
        </Button>
      </form>
    </ShopLayout>
  );
}

function Profile({
  name,
  email,
  phone,
  points,
  visits,
  tier,
}: {
  name: string;
  email: string;
  phone: string;
  points: number;
  visits: number;
  tier: string;
}) {
  const [formName, setName] = useState(name);
  const [formEmail, setEmail] = useState(email);
  const [error, setError] = useState("");
  return (
    <ShopLayout>
      <PageHead title="Your account" sub={`Signed in as ${phone}`} />
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[180px_1fr]">
        <BearMark className="mx-auto h-36 w-auto" />
        <form
          className="space-y-3 rounded-3xl bg-card p-5 shadow-warm"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              await updateProfile({ name: formName, email: formEmail });
              toast.success("Details saved");
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <p className="text-sm font-semibold text-muted-foreground">
            {tier} · {points} points · {visits} visits
          </p>
          <label className="block text-sm font-semibold">
            Name
            <input
              value={formName}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border-2 border-input px-3"
            />
          </label>
          <label className="block text-sm font-semibold">
            Email
            <input
              value={formEmail}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border-2 border-input px-3"
            />
          </label>
          <label className="block text-sm font-semibold">
            Phone
            <input
              value={phone}
              readOnly
              className="mt-1 h-11 w-full rounded-xl border-2 border-input bg-muted px-3"
            />
          </label>
          {error && (
            <p className="text-sm font-semibold text-primary" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Save details</Button>
            <Button type="button" variant="outline" onClick={signOutCustomer}>
              Sign out
            </Button>
            <Button asChild variant="secondary">
              <Link to="/orders">My orders</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/rewards">Rewards</Link>
            </Button>
          </div>
        </form>
      </div>
    </ShopLayout>
  );
}
