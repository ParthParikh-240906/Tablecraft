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

## To do (priority order)

1. **Stripe payments** (`/api/checkout`, `/api/webhooks/stripe`) — Checkout Session creation, webhook marks `orders.status = paid`. Needs user's test-mode `STRIPE_SECRET_KEY` in `.env.local` + `stripe` package install. **REVIEW GATE** (payments).
2. **Cart → checkout → order confirmation** — wire cart to checkout session, webhook, order status. Depends on #1.
3. **End-to-end QA pass** — create org → view site → book table → toggle capacity → checkout; numbered bug list → fix cycle.
4. **Public site polish** — responsiveness, loading/empty/error states, speed cleanup.
5. **Console polish + realtime reliability** — UX, channel reconnect/edge cases.
6. **Stripe edge cases** — session expiration, webhook idempotency, order status reconciliation.
7. **Demo assets** — polish seeded demo data for judges.
8. **Deploy** — Vercel, final fixes, dress rehearsal.