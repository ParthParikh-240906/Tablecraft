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

## Demo seed

```bash
curl -X POST http://localhost:3000/api/demo/setup
```

## Tests & checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Deploy on Vercel

Live at **[https://tablecraft-beige.vercel.app/](https://tablecraft-beige.vercel.app/)**. Add the same `.env.local` variables to Vercel project settings before deploying.
