# Grizzly Pizzeria

Project rules for this repo. There is no hosted app builder in the toolchain.

## Stack

Keep TanStack Start, TanStack Router, Vite, React 19, Tailwind 4, and the existing shadcn/ui setup. Do not migrate frameworks. Node >= 20.19. Package manager is npm.

## Routes

File routes live in `src/routes`. Read `src/routes/README.md` before adding a page. `routeTree.gen.ts` is generated; never edit it by hand. The app shell is `src/routes/__root.tsx` and must keep `<Outlet />`.

New pages:

- Add `src/routes/name.tsx` for `/name`, or `src/routes/area.name.tsx` for `/area/name`.
- Call `createFileRoute` with the matching path.
- Customer pages use `ShopLayout` and `seo()`.
- Owner pages render inside the `/admin` layout (`StaffShell` area `admin`).
- Kitchen pages render inside the `/kitchen` layout.

## Data and money

Components talk to `src/services/api.ts` only. Do not read `localStorage` from a component. Prices, tax, packaging, coupons and loyalty go through `src/services/pricing.ts`. Persistent data lives in SQLite (`src/server`). Staff and customer passwords are scrypt hashes; sessions are encrypted cookies.

## Brand

Tokens stay in `src/styles.css`: Grizzly Red `#AF2225`, Beige `#EEC6A2`, Cream `#FBF3EA`, Deep Red `#7E1519`, Cocoa `#2A1412`, Soft Beige `#F6E3D0`. Unbounded for headings, Outfit for body. Motion uses ease `[0.22, 1, 0.36, 1]` and respects `prefers-reduced-motion`. Money is shown in Rs.

Logo files: `public/brand/logo.png` and `public/brand/bear.png`.

## Integration markers

Mark unfinished provider wiring with `// INTEGRATION:` (payments, SMS, object storage).
