# Grizzly Pizzeria

Pickup ordering for Grizzly Pizzeria, two outlets in Madhapur, Hyderabad. Customers build a box, kitchens run the live board, and the owner watches both outlets. Payments and WhatsApp are clearly marked demo.

## Stack

TanStack Start, TanStack Router (file routes in `src/routes`), Vite, React 19, Tailwind 4, shadcn/ui, Framer Motion, Recharts, qrcode.react, html5-qrcode, Zod, Sonner.

Package manager: **npm** (`package-lock.json`). `bun.lock` was removed so there is only one lockfile. Node **>= 20.19** (see `.nvmrc`).

## Run

```sh
nvm use
npm install
npm run dev
```

Dev server: http://localhost:5173

```sh
npm run build
npm run preview
npm test
npm run lint
```

`npm run build` emits a Node server (Nitro `node-server`) for a Hostinger VPS, not Cloudflare.

## Demo logins

| Who              | How                                                               |
| ---------------- | ----------------------------------------------------------------- |
| Customer         | Any 10-digit phone, OTP `1234`                                    |
| Owner            | `owner` / `grizzly`                                               |
| Kitchen outlet 1 | `kitchen.outlet1` / `grizzly`                                     |
| Kitchen outlet 2 | `kitchen.outlet2` / `grizzly`                                     |
| Coupons          | `BEAR50` (Rs 50 off, min Rs 399), `SLICE10` (10% off, min Rs 299) |

## Project structure

- `src/routes` — file routes. Do not edit `src/routeTree.gen.ts` by hand.
- `src/services/api.ts` — the only data access components should use.
- `src/services/pricing.ts` — bill, coupons, loyalty maths.
- `src/services/store.ts` — demo `localStorage` database.
- `public/brand` — logo and bear mark.

## Known limitation

`RootComponent` in `src/routes/__root.tsx` waits for hydration before showing the app, behind the branded loader. That keeps the demo store consistent, and it hurts first paint and SEO until a real backend renders the menu on the server.

## // INTEGRATION: points

- `src/lib/report-error.ts` — error reporting (Sentry or similar).
- `src/services/api.ts` — replace localStorage with HTTP; SMS OTP; real payments.
- `src/services/store.ts` — browser storage stand-in.
- `src/routes/admin.menu.tsx` — image upload is a data-URL mock.
- Checkout and order pages — online payment and WhatsApp are simulated. Only online payment creates a pickup QR.
