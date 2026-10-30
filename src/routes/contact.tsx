import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHead, ShopLayout, seo } from "@/components/shop/ShopLayout";
import { saveMessage } from "@/services/api";
import { useDB } from "@/services/store";

export const Route = createFileRoute("/contact")({
  head: () =>
    seo(
      "Contact · Grizzly Pizzeria",
      "Call, WhatsApp or write to Grizzly Pizzeria in Madhapur.",
      "/contact",
    ),
  component: ContactPage,
});

function ContactPage() {
  const db = useDB();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [outletId, setOutletId] = useState<string | null>(db.outlets[0]?.id ?? null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const wa = db.settings.whatsapp;

  return (
    <ShopLayout>
      <PageHead
        eyebrow="Madhapur"
        title="Contact"
        sub="Two outlets, one bear. Messages stay in this demo."
      />
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-2">
        <div className="space-y-3">
          {db.outlets.map((outlet) => (
            <article key={outlet.id} className="rounded-3xl bg-card p-5 shadow-warm">
              <h2 className="text-2xl">{outlet.short}</h2>
              <p className="mt-1 text-sm">{outlet.address}</p>
              <p className="text-sm text-muted-foreground">{outlet.hours}</p>
              <p className="text-sm">Phone {outlet.phone}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  className="inline-flex h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  href={outlet.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Map
                </a>
                <a
                  className="inline-flex h-11 items-center rounded-full bg-secondary px-4 text-sm font-semibold"
                  href={`https://wa.me/91${wa}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp (demo)
                </a>
              </div>
            </article>
          ))}
          <p className="text-sm text-muted-foreground">
            Shop email {db.settings.email}. The WhatsApp button does not send a message.
          </p>
        </div>
        <form
          className="space-y-3 rounded-3xl bg-card p-5 shadow-warm"
          onSubmit={async (e) => {
            e.preventDefault();
            setStatus("loading");
            setError("");
            try {
              await saveMessage({ name, phone, message, outletId });
              setStatus("done");
              setMessage("");
              toast.success("Message saved in the demo store");
            } catch (err) {
              setStatus("error");
              setError((err as Error).message);
            }
          }}
        >
          <h2 className="text-2xl">Write to us</h2>
          <label className="block text-sm font-semibold">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border-2 border-input px-3"
            />
          </label>
          <label className="block text-sm font-semibold">
            Phone
            <input
              value={phone}
              inputMode="numeric"
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="mt-1 h-11 w-full rounded-xl border-2 border-input px-3"
            />
          </label>
          <label className="block text-sm font-semibold">
            Outlet
            <select
              value={outletId ?? ""}
              onChange={(e) => setOutletId(e.target.value || null)}
              className="mt-1 h-11 w-full rounded-xl border-2 border-input px-3"
            >
              {db.outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.short}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl border-2 border-input px-3 py-2"
            />
          </label>
          {status === "error" && (
            <p className="text-sm font-semibold text-primary" role="alert">
              {error}
            </p>
          )}
          {status === "done" && (
            <p className="text-sm font-semibold text-success" role="status">
              Saved. The owner can read it in the audit page.
            </p>
          )}
          <Button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Sending…" : "Send message"}
          </Button>
        </form>
      </div>
    </ShopLayout>
  );
}
