# Grizzly Pizzeria

Pickup ordering for Grizzly Pizzeria, two outlets in Madhapur, Hyderabad. Customers build a box, kitchens run the live board with real wait times, and the owner watches both outlets.

## Stack

TanStack Start, TanStack Router (file routes in `src/routes`), Vite, React 19, Tailwind 4, SQLite via libSQL (`data/grizzly.db`), scrypt password hashes, encrypted staff/customer sessions.

Package manager: **npm**. Node **>= 20.19** (see `.nvmrc`).

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

`npm run build` emits a Node server (Nitro `node-server`) for a Hostinger VPS. On Vercel the same build uses the Vercel preset, so there is no `dist` folder to set as the output directory. Leave that project setting empty. Set `GRIZZLY_SESSION_PASSWORD` (32+ characters) in the Vercel environment. The shop database on Vercel lives in the instance’s temporary disk and resets when that instance goes away.

## Staff logins

Usernames and passwords are hashed with scrypt and written into SQLite on boot. Change them with env vars (see `.env.example`). Defaults:

| Who              | Username           | Password           |
| ---------------- | ------------------ | ------------------ |
| Owner            | `owner`            | `Grizzly#Owner26`  |
| Kitchen outlet 1 | `kitchen.outlet1`  | `Grizzly#Kitchen1` |
| Kitchen outlet 2 | `kitchen.outlet2`  | `Grizzly#Kitchen2` |

Customers create an account with phone + password (8+ characters, letter and number). Sessions are AES-encrypted httpOnly cookies. Five failed staff attempts lock the account for 15 minutes.

Coupons: `BEAR50` (Rs 50 off, min Rs 399), `SLICE10` (10% off, min Rs 299).

## Kitchen wait times

Each menu item has prep minutes. Clock cooks in on **Crew**. Wait is a queue simulation: one cook handles one unit at a time, so fries can leave while a pizza is still in the oven. Customers show the same QR as items become ready; remaining items stay on the ticket.

## Project structure

- `src/routes` — file routes. Do not edit `src/routeTree.gen.ts` by hand.
- `src/services/api.ts` — the only data access components should use.
- `src/data` — SQLite, auth, order and attendance logic.
- `src/services/pricing.ts` — bill, coupons, loyalty maths.
- `public/brand` — logo and bear mark.

## // INTEGRATION: points

- `src/lib/report-error.ts` — error reporting (Sentry or similar).
- Checkout — connect a payment provider.
- `src/routes/admin.menu.tsx` — image upload is still a data-URL on the item.
