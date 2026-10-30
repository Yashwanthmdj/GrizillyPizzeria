import { createFileRoute } from "@tanstack/react-router";
import { StaffLogin } from "@/components/staff/StaffLogin";
import { seo } from "@/components/shop/ShopLayout";

export const Route = createFileRoute("/kitchen_/login")({
  head: () =>
    seo("Kitchen login · Grizzly Pizzeria", "Staff sign-in for Grizzly Pizzeria kitchens."),
  component: () => <StaffLogin area="kitchen" />,
});
