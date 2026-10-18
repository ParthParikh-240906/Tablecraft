# Launch page + custom domains — implementation plan (v2)

Status: **implemented** (MVP). Migration `0037_custom_domains_and_sessions.sql`, Launch page, domain APIs, Vercel integration, proxy routing, and the Free 2-session gate are in the tree. Apply the migration and set the Vercel env vars before using it.
Decisions locked by product owner:

- Hosting stays on **Vercel Hobby** for the MVP.
- **1 custom domain per restaurant.**
- **Free plan gets 0 custom domains.**
- Free plan is capped at **2 concurrent sessions per restaurant, website + console combined**.
- **Max → Pro:** keep the domain.
- **Pro/Max → Free:** remove the domain immediately.
- Apex vs `www`: apex is primary, `www` redirects to apex (implementation detail chosen below).
- Platform `/<slug>` URL: stays accessible, canonical points to the custom domain (chosen below).

---

## 1. Short answer

Yes, this is possible on Hobby, and it does not require Tablecraft to own a domain first.

One shared Next.js/Vercel project serves every restaurant. A customer domain is added to that project through the Vercel Domains API, the customer points DNS at Vercel, Vercel issues SSL, and the app resolves `Host` → restaurant → rewrites to the existing `/[orgSlug]` routes.

Hobby constraints to accept for the MVP:

| Hobby limit | Consequence |
|---|---|
| 50 custom domains per project | With an apex + `www` pair, roughly **25 restaurants** can have a custom domain. |
| Non-commercial use only | Fine while you are building/testing; upgrade to Pro before charging customers. |
| 1 concurrent build | Not relevant to this feature; just slower deploys. |
| 100 GB transfer / ~1M edge requests | Plenty for an MVP, but monitor it. |

Recommended mitigation for the 50-domain cap: treat the apex + `www` pair as **one logical domain per restaurant**, and show an admin warning when the project approaches 45 hostnames. If you need 50 restaurants with domains before upgrading, add only the exact hostname the owner enters (no automatic `www`). For now, the polished default is apex + `www`.

---

## 2. Plan limits — the real state

### No existing 2-user limit

There is no "2 concurrent users" limit in Tablecraft today, and it is not a Vercel/Supabase limit. It must be built explicitly. This plan adds it as a Free-plan product rule.

### Tablecraft quotas today

| Limit | Free | Pro | Max |
|---|---|---|---|
| Public website | Mock/demo positioning | Real hosted site | Real hosted site |
| Custom domain | **0 (new rule)** | **1 per restaurant** | **1 per restaurant** |
| Concurrent sessions (site + console) | **2 (new rule)** | Unlimited | Unlimited |
| AI chatbot messages / month | 50 | 300 | 1,000 |
| AI menu scans / month | 10 | 30 | 70 |
| AI images / month | 10 | 100 | 300 |
| Restaurants (lifetime) | 1 | 5 | 20 |
| Edit requests / month | 3 | 30 | 100 |

Source: `lib/owner-quotas.ts`.

### Existing rate limits (not concurrency)

`lib/rate-limit.ts` is an in-memory, per-instance API burst limiter:

- bookings: 20/min/IP
- chat bookings: 15/min/IP
- contact: 5/hour/IP
- demo endpoints: 20/min/IP
- menu scan: 10/day/org + 10/day/IP
- AI routes: monthly plan quotas

These remain as abuse brakes. They are not a substitute for the concurrency gate, which needs a shared store because serverless instances do not share memory.

### Infrastructure limits

| Platform | Real limits |
|---|---|
| Vercel Hobby | 100 GB transfer, ~1M edge requests, 1 concurrent build, **50 custom domains/project**, non-commercial |
| Supabase Free | 200 concurrent Realtime connections, 5 GB egress, 500 MB DB, 2 active projects, pauses after 7 days inactivity |

The 2-session gate is entirely our own database-backed rule.

---

## 3. Product behavior

### Sidebar

Add **Launch** to `ownerNavItems` in `app/(console)/console/sidebar.tsx`:

- Visible only to owners in the Management section (Design, Settings, Launch, Plan).
- Hidden for staff and demo sessions.
- Active state for `/console/launch`.
- Not added to `HeaderNav` (per the request).

### Launch page

`/console/launch?org=<id>`

1. **Your Tablecraft site** — current public URL, copy/open, live vs mock status.
2. **Connected domain** — domain, status, SSL state, primary badge, Check status / Open / Disconnect.
3. **Connect a domain** — input + Connect button.
   - Free: disabled, upgrade CTA to `/console/pricing`.
   - Pro/Max: allowed while the restaurant has 0 connected domains.
   - A restaurant can have **1 logical domain** (apex + optional `www`), not 2.
4. **DNS setup** — exact records returned by Vercel, copy buttons.
   - Apex: `A @ → 76.76.21.21` (or the value Vercel returns).
   - `www`: `CNAME www → cname.vercel-dns.com` (or the project-specific target).
   - Ownership TXT if the domain is already on another Vercel account: `TXT _vercel → <value>`.
   - Cloudflare note: set proxy to **DNS only** until verified.
   - SSL is automatic after DNS resolves; can take minutes to 48 hours.
5. **Troubleshooting** — old A/AAAA records, Cloudflare redirect loop, certificate pending.

### Statuses

`pending_dns` → `verifying` → `active` → `error` / `removed`.

### URL behavior

- Custom root `/` → restaurant landing.
- `/menu`, `/reserve`, `/cart`, `/cart/success` → the same restaurant pages.
- `/console`, `/dashboard`, `/signin`, `/signup` on a customer domain → 308 to the Tablecraft platform domain.
- `/api/*` on a customer domain continues to hit the same API routes.
- Platform `/<slug>` remains accessible.
- Canonical/OG points to the custom domain when one is active; **no 308 from `/<slug>` to the custom domain** (reason in §11).

### Apex vs www (decision)

- **Apex is canonical** (`example.com`).
- Add both apex and `www` to Vercel.
- Configure `www.example.com` → 308 `example.com` via Vercel's domain redirect.
- If the owner enters `www.example.com`, normalize the stored canonical to `example.com` and add the pair.
- If the owner enters `shop.example.com`, it is a single subdomain with no automatic sibling.

Why apex: it is what customers type, print on menus, and share. Vercel supports apex with an A record; the occasional regional apex issue is acceptable for an MVP, and `www` redirects to it.

---

## 4. Free plan 2-session gate

### Definition

A "session" is an active browser lease:

- **Website:** one browser session per visitor, identified by an HttpOnly cookie.
- **Console:** one signed-in user, identified by `auth_user_id`.
- **Combined:** both kinds share the same per-restaurant capacity counter.
- Limit: **2 active leases per restaurant** while the owner plan is Free.
- A lease expires after **120 seconds** without a heartbeat/navigation.
- Same browser with multiple tabs = one website lease.
- Same console user with multiple tabs = one console lease.
- A user with the console open and the site open on the same browser = two leases (one per surface), matching "website + console combined".

### Storage

New table `public.org_active_sessions` (service-role only, RLS enabled with no policies):

```sql
create table if not exists public.org_active_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  slot_key text not null,                 -- 'site:<uuid>' or 'console:<auth_user_id>'
  kind text not null check (kind in ('site', 'console')),
  auth_user_id uuid,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create unique index org_active_sessions_org_slot_key
  on public.org_active_sessions (org_id, slot_key);
create index org_active_sessions_org_expiry
  on public.org_active_sessions (org_id, expires_at);

alter table public.org_active_sessions enable row level security;
-- No policies: only the service role can read/write.
```

Atomic acquire function (prevents two first visitors both taking the last slot):

```sql
create or replace function public.acquire_org_slot(
  p_org_id uuid,
  p_slot_key text,
  p_kind text,
  p_limit int default 2,
  p_ttl_seconds int default 120
)
returns table (allowed boolean, active_count int, slot_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_id uuid;
begin
  -- Serialize acquisitions per restaurant.
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  delete from public.org_active_sessions
   where org_id = p_org_id and expires_at <= now();

  -- Existing lease: renew and allow.
  update public.org_active_sessions
     set last_seen_at = now(),
         expires_at = now() + make_interval(secs => p_ttl_seconds)
   where org_id = p_org_id and slot_key = p_slot_key
   returning id into v_id;

  if v_id is not null then
    select count(*) into v_count
      from public.org_active_sessions where org_id = p_org_id;
    return query select true, v_count, v_id;
    return;
  end if;

  select count(*) into v_count
    from public.org_active_sessions where org_id = p_org_id;

  if v_count >= p_limit then
    return query select false, v_count, null::uuid;
    return;
  end if;

  insert into public.org_active_sessions (org_id, slot_key, kind, expires_at)
  values (p_org_id, p_slot_key, p_kind, now() + make_interval(secs => p_ttl_seconds))
  returning id into v_id;

  return query select true, v_count + 1, v_id;
end;
$$;
```

Also add helpers or use direct service-role queries:

- `touch_org_slot(orgId, slotKey, ttl)` — update `last_seen_at`/`expires_at`.
- `release_org_slot(orgId, slotKey)` — delete on logout/pagehide.

### Where the gate runs

**Website:** Next 16 `proxy.ts` (renamed from `middleware.ts`) on document requests.

- Only `GET`/`HEAD` document navigations (`sec-fetch-dest: document` or `Accept: text/html`).
- Skip `next-router-prefetch`, `sec-purpose: prefetch`, `_next/*`, static assets, API routes.
- Skip the marketing site, `/signin`, `/signup`, `/privacy`, `/terms`, `/dashboard`, `/console/login`.
- Only restaurant public paths (`/[slug]`, `/[slug]/menu`, `/reserve`, `/cart`, `/cart/success`) and active custom domains.
- Resolve the org, check the owner plan (cached 60s), skip if Pro/Max or demo.
- For Free: call `acquire_org_slot(orgId, 'site:<cookie>', 'site', 2, 120)`.
- If allowed: continue the rewrite/normal navigation and set `tc_site_session` if new.
- If blocked: rewrite to `/capacity?kind=site` with a 429-style branded page and `Retry-After: 120`.

**Console:** `app/(console)/console/layout.tsx` after `getActiveStaffRow`.

- Resolve the owner plan; skip if Pro/Max or demo.
- For Free: `acquire_org_slot(orgId, 'console:<user.id>', 'console', 2, 120)`.
- If blocked: render a capacity panel instead of the sidebar/children, with "Retry" and "Back to site".
- This avoids duplicating the console's complex org-resolution logic inside the proxy.
- `/console/login` is outside the console layout, so a blocked user can still sign in and see the capacity message.

**Public APIs:** `/api/bookings`, `/api/chat/bookings`, `/api/cart/checkout` call a shared `assertSiteSlot(orgId, request)` before doing work. If the visitor has no valid lease, return `429` with the capacity message. This prevents bypassing the page gate with direct POSTs.

**Console APIs:** optional hardening for the MVP. The page gate prevents normal use; adding the check to `requireOwnerForSlug` / `requireStaffForOrgId` would also throttle direct API calls, but costs an RPC on every console API request. Defer unless abuse appears.

### Cookie

- Name: `tc_site_session`
- Value: random UUID
- `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, 1-year expiry
- Host-only, so each customer domain gets its own visitor identity.
- If cookies are disabled, fall back to `site:ip:<sha256(ip + user-agent)>` to avoid a visitor locking themselves out.

### Heartbeat / release

- Client component `SessionHeartbeat` mounted in:
  - `app/(console)/console/layout.tsx`
  - `app/(public)/[orgSlug]/layout.tsx`
- `POST /api/session/heartbeat` every 30s.
  - Website: reads `tc_site_session`, resolves org from `orgSlug`/host, touches the lease.
  - Console: authenticates the user, touches `console:<user.id>`.
- On `pagehide`/logout, `navigator.sendBeacon('/api/session/release', ...)`.
- If a heartbeat finds an expired/missing lease and capacity is available, it re-acquires. If capacity is full, the client shows the capacity state on the next navigation.

### Concurrency consequences to accept

- On Free, if 2 customers are browsing the website, the owner/chef **cannot open the console** until one lease expires or is released.
- If 1 customer is browsing and 1 chef is in the console, a second chef/waiter is blocked.
- This is the requested behavior. A future improvement would reserve one console slot or let console sessions evict the oldest site session; not in this MVP.
- Bots/crawlers can consume a site lease for up to 120s. Exclude obvious bots by user-agent and never gate prefetches/HEAD/API.
- A diner who walks away without closing the tab keeps a lease for up to 120s after the last heartbeat.

---

## 5. Data model

### `organization_domains`

Migration `supabase/migrations/0037_organization_domains.sql`:

```sql
create table if not exists public.organization_domains (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  hostname text not null,              -- canonical, punycode, lowercase, no protocol/path/port
  alternate_hostname text,             -- optional www/apex partner
  kind text not null check (kind in ('apex', 'subdomain')),
  status text not null default 'pending_dns'
    check (status in ('pending_dns', 'verifying', 'active', 'error', 'removed')),
  is_primary boolean not null default true,
  verification jsonb not null default '[]'::jsonb,
  dns_records jsonb not null default '[]'::jsonb,
  ssl_status text,
  last_error text,
  verified_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organization_domains_hostname_key
  on public.organization_domains (lower(hostname))
  where status <> 'removed';

create unique index organization_domains_alternate_key
  on public.organization_domains (lower(alternate_hostname))
  where status <> 'removed' and alternate_hostname is not null;

create unique index organization_domains_one_per_org
  on public.organization_domains (org_id)
  where status <> 'removed';

create index organization_domains_org_idx
  on public.organization_domains (org_id);

alter table public.organization_domains enable row level security;

create policy "owners_read_own_domains"
  on public.organization_domains for select
  to authenticated
  using (
    exists (
      select 1 from public.staff_users
      where staff_users.org_id = organization_domains.org_id
        and staff_users.auth_user_id = auth.uid()
        and staff_users.role = 'owner'
    )
  );
```

Notes:

- `one_per_org` enforces 1 logical domain per restaurant.
- `alternate_hostname` lets one row own the apex + `www` pair, so the UI and plan limit treat them as one.
- Writes only via the service-role API.
- Keep `removed` rows for audit.

### `org_active_sessions`

Defined in §4. Service-role only.

Both tables cascade on org delete, but the Vercel domains must be removed through the API before the org row disappears (see §14).

---

## 6. Library modules

### `lib/domains.ts`

Pure logic, unit-testable:

- `normalizeDomain(input)`:
  - trim, lowercase, strip protocol/path/query/port/trailing slash.
  - IDN → punycode via `domainToASCII` (`node:url`).
  - validate labels, length, TLD, no wildcard, no leading/trailing hyphen.
  - reject IPs, `localhost`, `.local`, `*.vercel.app`, the Tablecraft platform host, reserved names.
- `getDomainPair(input)`:
  - `example.com` → canonical `example.com`, alternate `www.example.com`.
  - `www.example.com` → canonical `example.com`, alternate `www.example.com`.
  - `shop.example.com` → canonical `shop.example.com`, no alternate.
- `isApexDomain`.
- `DOMAIN_LIMITS: Record<PlanTier, number> = { free: 0, pro: 1, max: 1 }`.
- `canAddDomain(plan, existingCount)`.
- `describeVercelStatus(projectDomain, config)` → status + user-facing reason.
- `buildDnsInstructions(projectDomain, config)` → A/CNAME/TXT rows.
- `siteHref(basePath, path)`.
- `canonicalUrl(hostname, path)`.

### `lib/vercel-domains.ts`

Server-only wrapper around the Vercel REST API (plain `fetch`):

- `addProjectDomain(hostname)` → `POST /v10/projects/{projectId}/domains?teamId=...`
- `getProjectDomain(hostname)` → `GET /v9/projects/{projectId}/domains/{hostname}`
- `verifyProjectDomain(hostname)` → `POST /v9/projects/{projectId}/domains/{hostname}/verify`
- `updateProjectDomain(hostname, patch)` → `PATCH ...` for `www` → apex redirect
- `removeProjectDomain(hostname)` → `DELETE ...`
- `getDomainConfig(hostname)` → `GET /v6/domains/{hostname}/config`

Rules:

- Env: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (server-only).
- 8s timeout per call.
- Map errors to `domain_in_use`, `invalid_domain`, `token_invalid`, `project_not_found`, `vercel_unavailable`, `rate_limited`.
- Log raw errors server-side; never send them to the browser.
- On delete, only `removeProjectDomain`. Do not call `domainsDeleteDomain` (that removes the domain from the customer's Vercel account).
- Hobby cap: before adding, list project domains or maintain a cached count; if ≥45, block with a friendly "MVP capacity reached" message and log an admin alert.

### `lib/capacity.ts`

- `getOwnerPlanForOrg(orgId)` — resolve owner plan with `resolveOwnerPlan`, 60s module cache.
- `getOrgPlanBySlug(slug)` — same, for proxy.
- `acquireSiteSlot(orgId, cookieValue, ip, userAgent)`.
- `acquireConsoleSlot(orgId, authUserId)`.
- `touchSlot`, `releaseSlot`.
- `assertSiteSlot(orgId, request)` for public APIs.
- `isBot(userAgent)`.
- Constants: `FREE_SESSION_LIMIT = 2`, `SLOT_TTL_SECONDS = 120`, `HEARTBEAT_MS = 30_000`.
- Demo orgs (`demo@tablecraft.app`) bypass the gate.

### `lib/site-url.ts`

- `getPlatformBaseUrl()`.
- `getRequestOrigin(request)` — validate a customer host against active `organization_domains` before using it in Stripe redirects.
- `absoluteSiteUrl(hostname, path)`.

---

## 7. API routes

All domain routes use `requireOwnerForSlug` (or a renamed `requireOwner`) and the service-role client.

| Route | Method | Purpose |
|---|---|---|
| `/api/domains` | `GET` | List the active org's domains. |
| `/api/domains` | `POST` | Validate + add to Vercel + insert row. |
| `/api/domains/[id]/verify` | `POST` | Force verification; refresh status/SSL. |
| `/api/domains/[id]/primary` | `POST` | Keep for future multi-domain support; with 1/restaurant it is mostly a no-op. |
| `/api/domains/[id]` | `DELETE` | Remove from Vercel, mark `removed`. |
| `/api/session/heartbeat` | `POST` | Renew the site or console lease. |
| `/api/session/release` | `POST` | Release the lease on logout/pagehide. |

`POST /api/domains` flow:

1. Owner auth for `orgSlug`.
2. Normalize/validate.
3. Plan check: Free → `402` with `{ upgradeUrl }`.
4. Check the restaurant already has a non-removed domain → `409`.
5. DB uniqueness check for the hostname/alternate.
6. Hobby capacity check (project domain count).
7. Vercel `addProjectDomain` for canonical + alternate.
8. If the domain is already on another Vercel account, return the TXT verification instructions and insert `pending_dns` with `verification`.
9. Configure `alternate_hostname` → 308 canonical.
10. Return the row + DNS instructions.

`verify` flow:

1. `verifyProjectDomain`.
2. `getProjectDomain` + `getDomainConfig`.
3. `active` only when ownership is verified and DNS is configured.
4. Persist `ssl_status`, `last_checked_at`, `last_error`.
5. Return the new state.

Rate limits:

- Domain adds: 5/hour/owner.
- Verify checks: 1 per 15s per domain.

Heartbeat/release routes must be cheap and validate ownership of the slot:

- Website: cookie + org slug/host.
- Console: Supabase auth + `console:<user.id>`.

---

## 8. Console page changes

### Route

`app/(console)/console/launch/page.tsx` (server component):

- `dynamic = "force-dynamic"`.
- Require user, active org, and `role === 'owner'`, otherwise redirect.
- Load org, domains, owner plan, platform URL.
- Pass data to `launch-client.tsx`.

### Client

`app/(console)/console/launch/launch-client.tsx`:

- Domain input with normalization feedback.
- Add / verify / disconnect actions.
- Status badge + DNS table with copy.
- Poll verify every 15–20s while pending.
- Free-plan upgrade card.
- Confirm disconnect.
- Show "1 domain per restaurant" and the `www` redirect explanation.
- Show the 2-session Free-plan notice when relevant.

### Sidebar

In `app/(console)/console/sidebar.tsx`:

- Add `isLaunchActive`.
- Add the Launch item to `ownerNavItems` with a rocket icon.
- Do not add it to `navItems` or `HeaderNav`.

### Owner guard

- Page: server-side role redirect.
- API: `requireOwnerForSlug`.
- Demo: hide the item and skip the API.

---

## 9. Proxy/middleware

Next 16 deprecates `middleware.ts` in favor of `proxy.ts`. Rename it and export `proxy`; proxy defaults to the Node.js runtime.

### Matcher

```ts
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)",
  ],
};
```

API routes are excluded so they are not rewritten; capacity is enforced inside the public API handlers.

### Logic order

```
const host = normalizeHost(request.headers.get("host"));
const platformHost = getPlatformHost();

if (isCustomHost(host)) {
  return handleCustomDomain(request, host); // no Supabase auth cookies here
}

// existing console/dashboard auth logic for the platform host
```

`handleCustomDomain`:

1. Skip `_next`, static, `favicon`, `robots`, `sitemap`, `/.well-known`.
2. `/console`, `/dashboard`, `/signin`, `/signup` → 308 to `${platformBase}${path}`.
3. Resolve active domain → org slug (cache 60s).
4. Unknown host → branded 404.
5. Free-plan capacity check for document requests (see §4).
6. Rewrite:
   - `/` → `/[slug]`
   - `/[path]` → `/[slug]/[path]`
   - preserve query.
7. Set request headers `x-tc-custom-domain: 1`, `x-tc-org-slug`, `x-tc-original-host`.
8. Do not create a Supabase auth client on custom hosts (prevents auth cookies on customer domains).

Platform host public pages:

- Only run capacity acquisition for restaurant document routes (valid org slug), not the marketing site.
- Resolve slug from the first path segment; verify it exists in a 60s cached `slug → { orgId, plan }` map.

### Free capacity cache

- `getOrgPlanBySlug` and domain lookup use module-level `Map`s with 60s TTL.
- This is per-instance, so a plan change can take up to 60s to apply in another instance. Acceptable for the MVP.
- The slot RPC itself is always shared/atomic.

---

## 10. Public link/metadata changes

Add a `basePath`/`customDomain` prop to the public components:

- `app/(public)/[orgSlug]/layout.tsx` reads `x-tc-custom-domain` and computes `basePath = isCustom ? "" : \`/${org.slug}\``.
- `components/PublicSiteFrame.tsx` — landing detection must work on `/` and `/${slug}`.
- `components/SiteHeader.tsx` — cart/menu/reserve links.
- `components/OrgPageView.tsx` — CTA links.
- `components/BookingChatbot.tsx` — reserve link.
- `app/(public)/[orgSlug]/cart/page.tsx` — back link + built-site redirect.
- `app/(public)/[orgSlug]/cart/success/page.tsx` — back link.
- `app/(public)/[orgSlug]/menu/page.tsx` — back link.

Metadata:

- On a custom domain, `generateMetadata` should use `title: { absolute: org.name }`, `alternates.canonical` = primary domain, and `openGraph.url`/`metadataBase` = custom origin.
- On the platform path, canonical points to the custom domain if one is active; otherwise `/${slug}`.
- This is the duplicate-content safeguard; no redirect from `/<slug>`.

Note: reading request headers in the public layout makes those routes dynamic. For the MVP this is acceptable; `getOrgBySlug` already has a 15s cache. If traffic grows, add a parallel custom-domain route group with the same components and `basePath=""` so platform routes stay static.

---

## 11. Origin/redirect fixes

These routes currently prefer `NEXT_PUBLIC_APP_URL` over the request origin, which would send customers back to the Tablecraft host after checkout on a custom domain:

- `app/api/cart/checkout/route.ts`
- `app/api/subscription/checkout/route.ts`
- `app/api/subscription/manage/route.ts`
- `app/api/stripe/connect/start/route.ts`
- `app/api/console/login/route.ts`

Plan:

1. Keep `NEXT_PUBLIC_APP_URL` as the platform/console origin.
2. For storefront checkout, resolve the origin from the request `Origin`/`Host` **only after validating it against an active domain for that org**; fall back to `NEXT_PUBLIC_APP_URL`.
3. Never reflect an arbitrary `Host` header into a Stripe URL.
4. If the org has a primary custom domain, prefer it for customer-facing redirects even when the request came from the platform host.
5. Keep console/auth/email links on the platform domain.

---

## 12. Plan entitlement and downgrade

### Limits

| Plan | Domains |
|---|---|
| Free | 0 |
| Pro | 1 per restaurant |
| Max | 1 per restaurant |

Since the plan is owner-wide (`resolveOwnerPlan`), one Pro/Max plan covers all the owner's restaurants, and each restaurant can connect one domain.

### Enforcement

- `DOMAIN_LIMITS` in `lib/domains.ts`.
- API checks `plan === 'free'` → 402; otherwise counts non-removed domains for that org → 409 if 1 exists.
- Launch page shows the same gate before the user types.
- Pricing/marketing copy: "Custom domain (1 per restaurant)" on Pro/Max; Free shows none. This is optional for the MVP but keeps the UI honest.

### Downgrade behavior

- **Max → Pro:** keep the domain untouched; both plans allow 1 per restaurant.
- **Pro/Max → Free:** remove immediately.
  - Trigger in the Stripe webhook after the plan fan-out updates the org rows.
  - Helper `removeDomainsForOwner(ownerId, reason)`:
    1. Find all non-removed domains for the owner's orgs.
    2. Remove each pair from Vercel (`removeProjectDomain`).
    3. Mark rows `removed`, clear primary.
    4. Log/email the owner (optional).
  - Also call the same helper lazily from the Launch page when it detects `plan === 'free'` with active domains, as a backstop for missed webhooks.
  - If a Vercel removal fails, keep `status = 'error'`/`last_error` and retry on the next check. Do not leave the DB claiming `active`.

The Free 2-session gate applies as soon as the plan resolves to Free, independently of domain removal.

---

## 13. Platform domain migration (still optional)

Not a blocker for customer domains. When you buy the Tablecraft domain:

1. Add apex + `www` to the Vercel project; set `www` → apex.
2. Set `NEXT_PUBLIC_APP_URL` to the new origin.
3. Replace hardcoded URLs:
   - `app/layout.tsx` metadata fallback
   - `public/robots.txt`
   - `public/sitemap.xml`
   - `README.md`
   - Supabase Auth Site URL + redirect allowlist
   - Stripe webhook/success URLs
   - Resend verified sender
4. Optional: wildcard `*.tablecraft.app` for `slug.tablecraft.app` (requires Vercel nameservers or ACME delegation).

Until then, customer domains point at the same `tablecraft-beige.vercel.app` deployment; that is fine because the customer never sees the deployment hostname.

---

## 14. Cleanup and operations

- **Delete restaurant** (`app/api/restaurants/delete/route.ts`): fetch domains first, remove them from Vercel, then delete the org.
- **Disconnect:** remove from Vercel, mark `removed`.
- **Downgrade to Free:** immediate removal via webhook + lazy backstop.
- **Stale sessions:** `acquire_org_slot` deletes expired rows opportunistically. Add an optional cleanup query/cron; a daily cron is enough.
- **Hobby domain cap:** warn at 45 hostnames; block gracefully at 50.
- **Monitoring:** log Vercel API failures; show a Launch-page banner if `VERCEL_TOKEN`/`VERCEL_PROJECT_ID` is missing.
- **Rate limits:** 5 adds/hour/owner; 1 verify per 15s/domain.
- **Abuse:** owner-only, normalized domains, reserved-name blocklist.

---

## 15. Tests

Unit:

- `lib/domains.ts`: normalization, punycode, apex/www pairing, reserved names, 1-per-restaurant limit, status mapping, DNS formatting.
- `lib/capacity.ts`: Free limit math, Pro/Max bypass, lease TTL, bot/prefetch exclusion, cookie fallback, demo bypass.
- `lib/site-url.ts`: platform origin, custom-domain link building, canonical URLs.
- Proxy: platform vs custom host, unknown host, console redirect, query preservation, document-only gating.

API:

- `POST /api/domains`: 401/403, Free 402, invalid 400, duplicate 409, Vercel 409/TXT, success.
- Verify: pending → active, misconfigured stays pending, Vercel errors mapped.
- Delete: owner-only, removes Vercel domain, marks removed.
- Heartbeat/release: renews, expires, releases, cannot touch another org's slot.
- Capacity: 2 allowed, 3rd blocked, Pro bypass, slot freed after TTL/release.
- Origin validation: arbitrary `Host` cannot control Stripe URLs.

Manual/E2E on a staging Vercel project:

- Connect a real test domain; verify apex A + `www` CNAME + 308 redirect.
- Verify SSL, landing, menu, reserve, cart, checkout success, chatbot, booking.
- Verify `/console` on the custom domain redirects to the platform.
- Verify non-owner staff gets 403/redirect.
- Verify Free cannot add a domain.
- Verify Free capacity: 2 site sessions allowed, 3rd blocked; 1 site + 1 console allowed, 3rd blocked; slots free after release/120s.
- Verify Max → Pro keeps the domain; Pro → Free removes it immediately.
- Verify disconnect removes the domain.

Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

---

## 16. Delivery phases

| Phase | Work | Estimate |
|---|---|---|
| 0 | Vercel token/project env vars; confirm Hobby cap handling | 0.5 day |
| 1 | Migrations (`organization_domains`, `org_active_sessions`, RPCs) + `lib/domains.ts` + `lib/capacity.ts` + tests | 1–1.5 days |
| 2 | Domain APIs + owner/plan guards + downgrade cleanup | 1 day |
| 3 | Launch page + sidebar + client UI | 1 day |
| 4 | Proxy host routing + public link basePath + metadata | 1 day |
| 5 | Free 2-session gate (proxy + console layout + heartbeat + public API checks) | 1–1.5 days |
| 6 | Origin/Stripe fixes, delete cleanup, E2E, polish | 1 day |

MVP total: roughly **5–6 working days** after the Vercel token is ready.

---

## 17. Decisions — resolved and remaining

Resolved:

- Hobby for the MVP.
- 1 domain per restaurant.
- Free = 0 domains.
- Free = 2 concurrent sessions (site + console combined).
- Max → Pro keeps the domain.
- Pro/Max → Free removes the domain immediately.
- Apex is canonical; `www` 308s to apex.
- `/<slug>` stays accessible; canonical points to the custom domain.

Remaining assumptions (chosen, change only if you disagree):

1. The 2-session gate counts **website visitors and console users** as separate leases; same browser with multiple tabs is one lease per surface.
2. A Free owner cannot open the console while 2 visitors are active. No reserved console slot in the MVP.
3. The apex + `www` pair counts as one logical domain but consumes two Vercel hostnames (Hobby cap ~25 restaurants).
4. Demo orgs bypass the concurrency gate.
5. Console API endpoints are not individually throttled in v1; the console page gate is the enforcement point.
6. Domain adds are capped at 5/hour/owner.

---

## 18. Acceptance criteria

- Owner sees **Launch** in the sidebar; staff and demo sessions do not.
- Free owner sees the upgrade CTA and cannot connect a domain via UI or API.
- Pro/Max owner can connect 1 domain per restaurant, sees exact DNS records, and can verify it.
- The custom domain serves landing, menu, reserve, cart, and checkout over HTTPS; `www` redirects to apex.
- Console/auth routes on the customer domain redirect to the Tablecraft platform.
- Public links work on both `/<slug>/...` and the customer domain.
- Free plan: 2 combined sessions allowed; the 3rd is blocked with a branded capacity page; the slot frees after release or 120s.
- Pro/Max: no concurrency gate.
- Max → Pro keeps the domain; Pro/Max → Free removes it immediately.
- Disconnecting removes the domain from Vercel and stops serving.
- No Vercel token, service key, or raw error detail reaches the browser.
- Two restaurants cannot claim the same domain.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.
