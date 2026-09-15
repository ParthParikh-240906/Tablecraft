# Tablecraft

An AI-powered website builder and operator console for restaurants and cafes — manage your website, tables, bookings, and orders all in one place.

🔗 **Live app:** [https://tablecraft-beige.vercel.app/](https://tablecraft-beige.vercel.app/)

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### 1. Install dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 2. Set up environment variables

Copy the example environment file and fill in your own API keys and credentials:

```bash
cp .env.example .env.local
```

Then open `.env.local` and fill in the values for each variable listed there. At minimum, you'll need keys/credentials for:

- **Supabase** — database and OAuth authentication
- **Stripe** — payment processing for Pro/Max plans
- **Resend** — feedback and inquiry emails
- **AI provider(s)** — powering the menu scanner, booking chatbot, image generator, and content generator

Refer to `.env.example` in the root of the project for the exact variable names required.

### 3. Run the development server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

This project is deployed and live at **[https://tablecraft-beige.vercel.app/](https://tablecraft-beige.vercel.app/)**.

The easiest way to deploy your own instance is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js. Make sure to add the same environment variables from `.env.local` to your Vercel project's Environment Variables settings before deploying.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.