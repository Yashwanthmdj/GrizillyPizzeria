import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StaffShell } from "@/components/staff/StaffShell";
import { seo } from "@/components/shop/ShopLayout";

export const Route = createFileRoute("/admin")({
  head: () =>
    seo("Owner dashboard · Grizzly Pizzeria", "Sales insights and controls for Grizzly Pizzeria."),
  component: () => (
    <StaffShell
      area="admin"
      nav={[
        { to: "/admin", label: "Insights" },
        { to: "/admin/orders", label: "Orders" },
        { to: "/admin/menu", label: "Menu" },
        { to: "/admin/customers", label: "Customers" },
        { to: "/admin/coupons", label: "Coupons" },
        { to: "/admin/outlets", label: "Outlets" },
        { to: "/admin/loyalty", label: "Loyalty" },
        { to: "/admin/settings", label: "Settings" },
        { to: "/admin/audit", label: "Audit" },
        { to: "/kitchen", label: "Kitchen" },
      ]}
    >
      <Outlet />
    </StaffShell>
  ),
});
