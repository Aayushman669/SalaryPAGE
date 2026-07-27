# Job Board

Next.js App Router job board with Supabase authentication, candidate workflows, recruiter management, company profiles, interviews, analytics, payments, and public SEO support.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the Supabase, site, payment, scheduler, and email values required for the features you use.
3. Apply the SQL migrations in `supabase/migrations` to the project database.
4. Start the development server with `npm run dev`.

## Validation

```bash
npx tsc --noEmit
npm run lint
npm run build
```

The production site URL should be set through `NEXT_PUBLIC_SITE_URL`; it is used for canonical URLs, sitemap, robots, and social metadata.
