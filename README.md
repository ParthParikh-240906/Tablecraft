# Tablecraft

An AI-powered website builder and operator console for restaurants and cafes — manage your website, tables, bookings, and orders all in one place.

🔗 **Live app:** [https://tablecraft-beige.vercel.app/](https://tablecraft-beige.vercel.app/)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in Supabase, Stripe, Resend, and AI provider keys (see `.env.example`).

### 3. Supabase migrations

```bash
npx supabase link --project-ref <ref>
npx supabase db push
# migrations live in supabase/migrations/*.sql
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stripe webhook (local)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Tests & checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Custom domains

The owner-only **Launch** page (`/console/launch`) attaches a customer domain to the shared Vercel project through the Domains API.

Required server env vars:

```bash
VERCEL_TOKEN=...
VERCEL_PROJECT_ID=prj_...
# Optional when the project belongs to a team
VERCEL_TEAM_ID=team_...
```

Optional DNS display defaults: `VERCEL_DNS_A_RECORD` (default `76.76.21.21`) and `VERCEL_DNS_CNAME` (default `cname.vercel-dns.com`).

Apply the migration first:

```bash
npx supabase db push
```

Product rules:

- Free: no custom domain, max 2 combined active website/console sessions (120s lease + heartbeat).
- Pro/Max: 1 custom domain per restaurant.
- Max → Pro keeps the domain; dropping to Free removes it immediately.

## Deploy on Vercel

Live at **[https://tablecraft-beige.vercel.app/](https://tablecraft-beige.vercel.app/)**. Add the same `.env.local` variables to Vercel project settings before deploying.
