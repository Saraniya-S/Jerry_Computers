# Jerry Computers — storefront

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Motion. Palette: light-only, taken from the JR logo (indigo `#372f63`, forest `#143d0c`, mint `#b8dcb5`); tokens in `src/app/globals.css`. `data-surface="dark"` gives a deep-indigo panel inside the light page (used for the Why Choose Us visuals).

```bash
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

## Before launch: fill in real business details

| What | Where |
| --- | --- |
| Address, map link, phone, email, hours, social links | `src/config/site.ts` (every `null` is unknown — the UI shows "To be confirmed") |
| Product catalogue | `src/data/products.ts` — currently a clearly marked **demonstration** catalogue, prices `null` ("Price on enquiry"). Replace `getFeaturedProducts()` with a database query. Add `image` to a product to use a photo instead of the built-in artwork. |
| Services | `src/data/services.ts` |
| Policy text | `src/app/policies/[slug]/page.tsx` (placeholder notice until content is approved) |

Routes `/services/request`, `/account` and `/products/[slug]` are placeholders that say plainly the booking, accounts and ordering features are not live yet.

## Brand

The JR badge is a vector trace of the supplied logo (`docs/reference/brand/jr-logo-original.webp`), kept in its original colours. It lives in `src/components/ui/Logo.tsx` (`brandColors`, `JR_PATHS`), with `src/app/icon.svg`, `src/app/apple-icon.png` and `public/brand-jr.svg` generated from the same paths.

## Homepage structure

`src/components/home/*` — one component per section:

- **Hero** — looping background video (`public/hero/hero-1080.mp4`, `hero-720.mp4` for small screens, `hero-poster.webp`), graded indigo from `docs/reference/hero-light-original.mp4` and crossfaded into a seamless loop. Pauses off-screen / in background tabs, stays on the poster under reduced motion, and has a pause button.
- **About** — hub-and-orbit integration map.
- **Services** — cards orbit the glowing Jerry mark on a tilted ring (upright, nearer cards larger and on top), then fold into the grid as you scroll; widgets animate with CSS. Only at ≥1024×600 with motion allowed (the stage scales down to fit short windows); a static grid otherwise.
- **Why choose us** — sticky stacking cards + scroll-lit word reveal.
- **Products** — elastic category reel (`src/components/products/reel/ElasticReel.tsx`, fed by `ProductsSection.tsx`): seven category slices that magnify around the pointer or a dragged finger, sweep a focus across while idle, and open into a full tile with the category's product count and a **Browse …** button to its section on `/products` (`/products#laptops`, …). Arrows, swipe and Esc/arrow keys move between categories; page scrolling is never captured.
- **Contact** and **Footer** read everything from `site.ts`.
