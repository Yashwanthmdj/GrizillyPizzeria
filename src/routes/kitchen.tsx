import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StaffShell } from "@/components/staff/StaffShell";
import { seo } from "@/components/shop/ShopLayout";

export const Route = createFileRoute("/kitchen")({
  head: () =>
    seo("Kitchen · Grizzly Pizzeria", "Live order board for Grizzly Pizzeria kitchen staff."),
  component: () => (
    <StaffShell
      area="kitchen"
      nav={[
        { to: "/kitchen", label: "Live orders" },
        { to: "/kitchen/scan", label: "Scan QR" },
        { to: "/kitchen/menu", label: "Menu" },
        { to: "/kitchen/settings", label: "Settings" },
      ]}
    >
      <Outlet />
    </StaffShell>
  ),
});
