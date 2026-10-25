# Jerry Computers — storefront

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Motion. Palette: warm graphite with copper accents, with dark and light themes (tokens in `src/app/globals.css`; `[data-theme]` scopes them, so a section can force `data-theme="dark"`). The theme follows the OS until the visitor uses the sun/moon toggle; the choice is saved in `localStorage` and applied before first paint by `src/lib/themeScript.ts`.

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

The JR badge is a vector trace of the supplied logo (`docs/reference/brand/jr-logo-original.webp`), recoloured to the copper palette. It lives in `src/components/ui/Logo.tsx` (`brandColors`, `JR_PATHS`), with `src/app/icon.svg`, `src/app/apple-icon.png` and `public/brand-jr.svg` generated from the same paths.

## Homepage structure

`src/components/home/*` — one component per section:

- **Hero** — looping background video per theme: `hero-1080.mp4` / `hero-720.mp4` (dark) and `hero-light-1080.mp4` / `hero-light-720.mp4` (light), each with a poster. Both are crossfaded into seamless loops (originals in `docs/reference/`). CSS (`.theme-dark-only` / `.theme-light-only`) shows the right one from first paint and only the visible one plays; pauses off-screen / in background tabs, stays on the poster under reduced motion, and has a pause button.
- **About** — hub-and-orbit integration map.
- **Services** — cards orbit the glowing Jerry mark on a tilted ring (upright, nearer cards larger and on top), then fold into the grid as you scroll; widgets animate with CSS. Only at ≥1024×820 with motion allowed; a static grid otherwise.
- **Why choose us** — sticky stacking cards + scroll-lit word reveal.
- **Products** — CSS-3D double helix (`src/components/products/helix`), simplified two-strand carousel on touch / small screens / reduced motion.
- **Contact** and **Footer** read everything from `site.ts`.
