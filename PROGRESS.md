# Tablecraft — Hackathon Build Log

**Coordinator:** Cline (COORDINATOR AGENT)
**Timeline:** 15 days (stretch to 18 with buffer day)
**Stack:** Next.js (App Router) + Tailwind | Supabase (Postgres/Auth/Realtime) | Stripe (test) | Vercel

---

## Working Rules

1. **Plan before code.** Every phase starts with a plan; Act mode only after approval.
2. **One scoped task per subagent.** No open-ended features. A task = a specific file or feature slice.
3. **Diff review gates.** Show the user diffs touching the **data model**, **auth**, or **payments** before merging. Auto-approve pure styling/UI tweaks.
4. **Branch per task.** Use `feature/<task>` branches (or worktrees where practical); discard bad attempts without touching `main`.
5. **Core-flow check every 2–3 tasks.** Run the app end-to-end to avoid silent drift.
6. **Unreliable subagent output → flag to user after 2 retries.** Do not silently change scope.
7. **Token watch.** Monitor Cline's cost tracker; flag anomalous burn (usually over-reading the codebase).
8. **Ask user before:** new external service/dependency, breaking schema change, cutting a spec feature.

## Definition of Done (Demo)

- [ ] Sign up a new restaurant org → get live public URL
- [ ] Public site: real menu, book a table, cart + Stripe test checkout
- [ ] Staff logs into console → toggles table status → reflected on public site without reload (Realtime, ~2s)
- [ ] ≥1 seeded demo restaurant for judges

---

## Done

### Product & content
- **Marketing homepage** (`/`) — product pitch: four pillars, how-it-works ticket, "Create your restaurant" CTA → `/signup`, "Contact us" mailto, "Sign in to your console" link. `4b018cb`
- **Restaurant directory** (`/restaurants`) — lists all live orgs. `4b018cb`
- **Org public site** (`/{slug}`) — landing, menu, reserve, cart. Each org's `theme_color` drives accents. `21d0484`, `c9b8a69`
- **In-app signup** (`/signup`) — email/password (no OAuth), creates org + owner + auth user → redirects to new public URL. `7132cbe`
- **Operator console** (`/console/*`) — staff login (Supabase Auth), live table status grid, bookings list, menu management. `5207858`, `c9b8a69`
- **Cross-product navigation** — marketing ↔ console ↔ public site links. (pending commit)

### Data & backend
- **Schema** — 6 tables, RLS (public read menu/tables/orgs; staff CRUD scoped to own org), realtime publication on `tables`. `c5b36b3`
- **Migrations applied** to hosted Supabase project `iydildntxvztlpjcoa`. `42ea23e`
- **Demo data** — Demo Diner (6 menu items, T1–T6, demo owner `demo-owner@demo.com` / `demo-password-123`). Linked to auth user.
- **Bookings API** (`/api/bookings`) — public write path, validated, RLS-bypass via service-role. Tested live. `5207858`
- **Signup API** (`/api/signup`) — org + owner + auth user creation with rollback. Tested live. `5207858`
- **Admin client** (`lib/supabase/admin.ts`) — server-only service-role client. `5207858`

### Realtime
- **Realtime hook** (`lib/realtime.ts`) — `useTableRealtime`, org-scoped channel. Smoke-tested live. `8256d6e`

### Design system
- **Token system** (`globals.css`) — paper/ink/rules/accent palette, Fraunces serif + Inter sans, hairline rules, small-caps labels, ticket/receipt motifs, `.surface-dark` utility. `2fc4b94`
- **Dark theme** applied across signup, console login, console dashboard. `2fc4b94`
- **Console login contrast bug** fixed (gray-400/500 on light bg → paper-raised on ink). `2fc4b94`

---

### Payments & Checkout
- **Stripe Integration** (`lib/stripe.ts`, `/api/checkout`, `/api/webhooks/stripe`) — Created checkout sessions with metadata and line items, robust Stripe webhook handling `checkout.session.completed` updating `orders.status = 'paid'` and storing `stripe_session_id`.
- **Order Confirmation Page** (`/[orgSlug]/orders/[orderId]`) — Ticket/receipt style display of ordered items, amounts, and live payment status confirmation.
- **Cart Organization Scoping** (`lib/cart.tsx`) — LocalStorage key and in-memory items isolated per `orgSlug` to eliminate cross-restaurant contamination.

### Console Enhancements
- **Booking Management** (`/console/bookings`, `booking-actions.tsx`) — Interactive booking status updates (Confirm / Cancel / Delete), dynamic table assignment limited to available/open tables, auto-marking tables as reserved in DB upon booking creation.
- **Booking Search & Filters** (`/console/bookings/page.tsx`) — Instant search filter in console bookings matching customer name or booking date/time strings.
- **Intelligent Table Allocation & 2-Hour Sliding Window** (`/api/bookings/route.ts`, `booking-form.tsx`) — Automated table allocation choosing the best-fit table (capacity ≥ party_size with least excess seats) scoped by `org_id`. Reservations have an automatic 2-hour max duration window; tables are released and available for booking outside any 2-hour overlapping confirmed reservation. Public booking form automatically handles table assignment without exposing manual table pickers.
- **Reservation Page Navigation** (`/[orgSlug]/reserve/page.tsx`) — Added 2 dedicated back buttons (top navigation arrow + bottom overview link) to navigate effortlessly back to the restaurant page.
- **Cart Feedback Centering** (`menu-items.tsx`) — Positioned the cart addition toast at the bottom-center of the viewport.
- **Menu Management with Images** (`/console/menu`, `menu-manager.tsx`) — Full image URL support in creation and edit forms, with image thumbnails displayed in the console list.
- **Interactive Table Status Controls** (`/console/tables/table-grid.tsx`) — Explicit 3-button status selector (Open / Occupied / Reserved) directly on each table card with real-time broadcast and DB synchronization.
- **Operator Session & Auth UX** — Auth callback (`/auth/callback`), Google OAuth buttons on login, session auto-redirect from `/`, `/console/login`, and `/signup` to `/console/tables` for logged-in operators, and dedicated "Sign out" control in operator console layout.
- **Contact & Reservation Hardening** — Contact form hooked directly to backend endpoint targeting `tablecraft8@gmail.com`; booking reservation forms block past dates/times with dynamic min bounds and instant validation.
- **UI & Experience Polish** — Added toast feedback notification on adding items to cart on public menu (`menu-items.tsx`); unified currency display across all public pages, cart, orders, and console to `AED`.
- **Operator Console Orders Management** (`/console/orders`, `orders-list.tsx`, `/api/orders/status`) — Full kitchen & online order management screen with filtering for Dine-in Table vs Online Orders, line item breakdowns, and real-time status management (Paid, Preparing, Ready, Completed, Cancelled).
- **Table vs Online Checkout Selection** (`/cart`, `/api/checkout`) — Dine-in guests can specify their table number or choose online takeout.
- **Button Debouncing & Simplified Reservation UI** (`menu-items.tsx`, `booking-form.tsx`) — Click-throttling on Add-to-cart buttons; simplified and clean confirmation message on booking creation.
- **Back Tablecraft Link on Public Sites** (`app/(public)/[orgSlug]/layout.tsx`) — Footer "Back Tablecraft" link on every org public site navigates back to the Tablecraft marketing page. Verified.
- **Network Access Fix (non-localhost)** (`next.config.ts`, `app/api/checkout/route.ts`, `lib/cart.tsx`, `app/(public)/[orgSlug]/cart/page.tsx`, `app/(auth)/console/login/page.tsx`, `.env.example`) — Added `allowedDevOrigins: ['192.168.1.30']` to fix Next.js dev server cross-origin blocking. Checkout route uses `NEXT_PUBLIC_APP_URL` / request origin / x-forwarded headers (no hardcoded localhost). Cart uses relative `/api/checkout` fetch. Login uses `window.location.origin` for OAuth redirect. `.env.example` documents `NEXT_PUBLIC_APP_URL`. NOTE: Supabase dashboard Authentication → URL Configuration must add `http://192.168.1.30:3000` to Site URL / Redirect URLs (manual dashboard step, not code). Verified.
- **Booking "Table Table 5" Duplication Fix** (`app/(console)/console/bookings/booking-actions.tsx`) — Display now uses `Table {table?.label}` (label already contains "Table 5"), no more duplication. Verified.
  - **Booking Table Status Update Error Handling** (`app/(console)/console/bookings/booking-actions.tsx`) — Confirming a booking marks the table reserved; cancelling releases it to open; both with error logging. Verified.
  - **Derived Table Status (2h window)** (`app/(console)/console/tables/table-grid.tsx`) — Computed status: table auto-shows "Reserved" starting 2h before a confirmed booking time, displays "Reserved {time}" under the table. Read-time derived, no cron job. Verified.

### Theme System Enhancements
- **Theme Preset System** (`lib/theme.ts`) — 5 curated theme presets (Midnight Ember, Forest Canopy, Ocean Depth, Sunset Clay, Racing Silver) with predefined main, text, and secondary colors for instant theming.
- **Enhanced Signup Theme Selection** (`app/signup/page.tsx`) — Interactive theme picker with visual color swatches, immediate selection feedback, and preset-based color application to new restaurants.
- **Secondary Color & Text Color Support** — Extended theme system with `theme_secondary_color` (buttons, headers) and `theme_text_color` (foreground readability) for complete visual customization.
- **Tagline Support** — Added optional tagline field to signup and organizations table for personalized restaurant messaging on public sites.
- **Optional Signup Fields** — Branches/locations, contact phone/email/address fields for comprehensive restaurant profile data.
- **Restaurant Image Upload** — Added restaurant photo upload (separate from logo/background) with dedicated storage bucket `org-restaurant-images`, displayed on public landing pages.
- **About Text Section** — Added `about_text` field and textarea in signup form for restaurant descriptions, enabling scrollable About sections on public sites.
- **Theme Text Color Migration** — Added migration 0007_theme_text_color.sql for `theme_text_color` column with default values for existing orgs.

### Bug Fixes & Safety Improvements
- **Auth User Deletion Fix** (`scripts/delete-org.mjs`, `app/api/orgs/[orgId]/route.ts`) — Fixed deletion logic to properly remove Supabase Auth users when deleting organizations. Uses org-first order (safer failure mode) with auth cleanup as non-critical post-delete step. Both manual script and API route now consistent.
- **Header Color Scheme Fix** (`app/(public)/[orgSlug]/layout.tsx`) — Changed header background to use secondary color instead of main color for better visual hierarchy (e.g., Racing Silver: white background, black text, red button).
- **Login Error Security** (`app/(auth)/console/login/page.tsx`) — Changed login error messages from detailed staff role information to generic "Invalid credentials" for security.
- **About Text Data Flow** (`app/signup/page.tsx`, `app/api/signup/route.ts`) — Added missing about_text field to signup form, state management, FormData submission, and API handling for complete About section functionality.
- **Delete Logic Safety** — Verified multi-org safety (unique constraint on auth_user_id prevents cross-org impact), implemented fail-safe deletion order, added proper error handling for both terminal script and API route contexts.

---

## To do (priority order)

1. **Stripe Keys Configuration** — Add live/test `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET` in `.env.local` (or Supabase/Vercel secrets) to test live payment card processing end-to-end.
2. **End-to-end QA pass** — create org (`/signup`) → view site (`/{slug}`) → book table (`/reserve`) → toggle table status in console (`/console/tables`) & observe realtime change → checkout cart with Stripe → confirm order.
3. **Deploy & Production Readiness** — Deploy to Vercel, configure production environment variables, run dress rehearsal.
