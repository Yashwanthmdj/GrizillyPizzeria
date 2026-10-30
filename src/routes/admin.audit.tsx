import { createFileRoute } from "@tanstack/react-router";
import { StoreGate } from "@/components/admin/ui";
import { useDB } from "@/services/store";

export const Route = createFileRoute("/admin/audit")({
  component: () => (
    <StoreGate>
      <AuditAdmin />
    </StoreGate>
  ),
});

function AuditAdmin() {
  const db = useDB();
  return (
    <div>
      <h1 className="text-4xl">Audit log</h1>
      <p className="mt-1 text-sm text-muted-foreground">Who changed what, on this device.</p>
      {db.audit.length === 0 ? (
        <p className="mt-6 rounded-3xl border-2 border-dashed p-10 text-center font-display text-2xl">
          No changes recorded yet.
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {db.audit.map((entry) => (
            <li key={entry.id} className="rounded-2xl bg-card px-4 py-3 shadow-warm">
              <p className="font-semibold">{entry.action}</p>
              <p className="text-sm">{entry.detail}</p>
              <p className="text-xs text-muted-foreground">
                {entry.actor} · {new Date(entry.at).toLocaleString("en-IN")}
              </p>
            </li>
          ))}
        </ol>
      )}
      {db.messages.length > 0 && (
        <section className="mt-8">
          <h2 className="text-2xl">Contact messages</h2>
          <ul className="mt-3 space-y-2">
            {db.messages.map((message) => (
              <li key={message.id} className="rounded-2xl bg-muted px-4 py-3 text-sm">
                <b>{message.name}</b> · {message.phone}
                <p className="mt-1">{message.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
