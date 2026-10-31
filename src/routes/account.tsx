import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BearMark, LoadingScreen } from "@/components/brand";
import { PageHead, ShopLayout, seo } from "@/components/shop/ShopLayout";
import { AuthPanel } from "@/components/shop/AuthPanel";
import { signOutCustomer, updateProfile } from "@/services/api";
import { tierFor } from "@/services/pricing";
import { useDB, useSession, useStoreReady } from "@/services/store";

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
  const ready = useStoreReady();
  if (!ready) return <LoadingScreen />;
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
  return (
    <ShopLayout>
      <PageHead title="Your account" />
      <div className="mx-auto max-w-md px-4 py-10">
        <AuthPanel />
      </div>
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
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
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
