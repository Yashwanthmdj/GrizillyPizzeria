import { createFileRoute } from "@tanstack/react-router";
import { StaffLogin } from "@/components/staff/StaffLogin";
import { seo } from "@/components/shop/ShopLayout";

export const Route = createFileRoute("/admin_/login")({
  head: () =>
    seo("Owner login · Grizzly Pizzeria", "Owner dashboard sign-in for Grizzly Pizzeria."),
  component: () => <StaffLogin area="admin" />,
});
