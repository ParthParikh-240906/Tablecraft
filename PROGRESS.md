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

## Day-by-Day Plan

### Day 1 — Scaffold + Schema
- [x] Next.js (App Router) + Tailwind scaffold; Supabase client + env setup; git init + branch discipline. GitHub repo created (private), clean history pushed to main + feature/schema.
- [ ] **Schema Agent:** `/supabase/migrations/*.sql` — 6 tables + RLS + `seed.sql` (Demo Diner)
- [ ] REVIEW GATE: full schema/RLS diff shown to user before merge

### Day 2 — Schema solidify + Auth foundation
- [ ] Apply migrations; verify seed; confirm public-read + org-scope RLS
- [ ] Supabase Auth with `staff_users ↔ auth_user_id` linking; API-route write path for bookings

### Day 3 — Web Agent slice 1: landing + menu
- [ ] `app/(public)/[orgSlug]/page.tsx` landing; `menu/page.tsx` + category view (public policy read)
- [ ] Auto-approve (read + styling)

### Day 4 — Realtime foundation
- [ ] Supabase Realtime channel abstraction for `tables`

### Day 5 — Web Agent slice 2: booking form + cart
- [ ] `app/(public)/[orgSlug]/reserve`; cart context + `cart/page.tsx`
- [ ] Cart writes via API routes only

### Day 6 — Console Agent slice 1: auth + table grid
- [ ] `app/(console)/login` (Supabase Auth gated by `staff_users`); `tables` status toggle grid
- [ ] REVIEW GATE: auth-gating diff shown to user

### Day 7 — Console Agent slice 2: bookings list + realtime
- [ ] Bookings list page; wire realtime console→public within ~2s

### Day 8 — Payments Agent: checkout + webhook
- [ ] `app/api/checkout/*` (Stripe Checkout Session); `app/api/webhooks/stripe` → `orders.status=paid`
- [ ] REVIEW GATE: payments diff shown to user

### Day 9 — Integration: cart → checkout → confirmation
- [ ] cart → checkout session → webhook → order confirmation (Stripe test)

### Day 10 — QA full flow
- [ ] create org → view site → book table → toggle capacity → checkout; numbered bug list → fix

### Day 11 — Public site polish
- [ ] Responsiveness, loading/empty/error states, speed cleanup

### Day 12 — Console polish + realtime reliability
- [ ] Console UX, channel reconnect/edge cases

### Day 13 — Stripe edge cases
- [ ] Session expiration, webhook idempotency, order status reconciliation

### Day 14 — QA final pass + demo assets
- [ ] Full re-run; polish seeded demo data for judges

### Day 15 — Dress rehearsal + deploy
- [ ] Rehearse demo script; deploy to Vercel; final fixes; buffer day (Day 16–18 spillover)

---

## Task Log

_Append a row after completing each task._

| Date | Task | Agent | Branch | Status | Notes |
|------|------|-------|--------|--------|-------|
| Day 1 | Repo + scaffold + shared Supabase client | Coordinator | main | DONE | 33d1785 pushed; clean history |
| Day 1 | Schema migration + RLS + seed | Schema | feature/schema | IN PROGRESS | pending review gate |