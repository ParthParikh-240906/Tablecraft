# Tests

Unit + API-route tests for the whole app: console, sign-in, dashboards, and everything behind them.

```bash
npm test          # run once
npm run test:watch  # watch mode
```

No DB, no network, no credentials needed. `tests/setup.ts` injects dummy
env vars (real handlers are imported; only validation branches run by default).
Routes that need Supabase mock `@/lib/supabase/server` + `@/lib/supabase/admin`
with a thenable query builder (see `tests/api/orders-routes.test.ts`).

## Coverage

| File | What it proves |
|---|---|
| `unit/design.test.ts` | `lib/design.ts`: hex/rgba, shadows, rect clamp, factories, `hydrateSettings` never throws on legacy JSONB, shape stacking, font remap, content builders, templates |
| `unit/pricing.test.ts` | `lib/pricing.ts` plan config + mocked Stripe `ensurePriceIds`, `MARKETING_PLANS` price/CTA consistency |
| `unit/order-token.test.ts` | `lib/order-token.ts`: deterministic HMAC, tamper/wrong-order/null rejection, no-secret fail-closed |
| `unit/theme.test.ts` | `lib/theme.ts` canonical colors, `lib/textAnimations.ts` all 4 variants |
| `unit/validation.test.ts` | Slug/UUID/email regexes, `safeNext` open-redirect block, booking + order-quantity + status-allowlist + contact + slug-generation rules (mirrors middleware, api-auth, bookings, orders, contact, signup) |
| `unit/bookings-logic.test.ts` | Table auto-assign: movable combining (1→4, 2→6…), non-movable tie-break, greedy combo fallback, conflict-window math, immediate-booking filter |
| `unit/dashboard-console.test.ts` | Dashboard stats, parent/child order grouping + totals, KDS filter/FIFO, earnings aggregation, `Table X` label build/parse, `?org=` nav contract |
| `unit/auth-error-handling.test.ts` | Sign-in rate-limit mapping (no enumeration), console fallback 5xx vs 4xx, `?error=` banners, middleware redirect targets, demo-check failure, `?next=` preservation |
| `unit/org-errors.test.ts` | `OrgFetchError` code/name, `getOrgs`/`getMenuByOrg` throw on DB failure (error UI, never empty state), category grouping + `Other` fallback |
| `api/contact.test.ts` | Live `POST /api/contact`: invalid JSON, name/email/message 400s, success path |
| `api/bookings-route.test.ts` | Live `POST /api/bookings` validation: JSON, org, name, partySize, tableIds, datetime, past, orgId format, no internal leaks |
| `api/signup-checkout-console-login.test.ts` | `signup-account` (email/password), `subscription/checkout` (plan/email/orgId), `console/login` (JSON/required fields) 400s |
| `api/orders-routes.test.ts` | Mocked `orders/create|status|update|delete`: 400/401/403/404 branches, quantity allowlist, status allowlist, happy-path table release |

## Notes

- `findBestCombination` / `findNonMovableCombo` are not exported from
  `app/api/bookings/route.ts`, so `bookings-logic.test.ts` mirrors them
  faithfully — if prod changes, update both.
- `stderr` output during runs (e.g. `getOrgs: …`, `[orders/status] …`) is
  the app's own `console.error` logging being exercised — expected.
