# NovaSoft Site

Production-ready marketing site for NovaSoft built with Next.js 14 App Router, TypeScript, Tailwind CSS, Contentlayer, and next-intl.

## Tech Stack

- Next.js 14 with App Router and TypeScript
- Tailwind CSS with typography plugin
- next-intl for localized routing (`/en`, `/fr`)
- Contentlayer MDX for legal copy
- Zod validation on client and API
- Plausible analytics (optional)
- Playwright smoke tests

## Getting Started

```bash
npm install
npm run dev
```

The site is available at [http://localhost:3000](http://localhost:3000). Locale-aware routes live under `/en` and `/fr`.

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the values that apply to your deployment.

- `NEXT_PUBLIC_SITE_URL`: Canonical URL (required in production)
- `NEXT_PUBLIC_DEFAULT_LOCALE`: Default language (`en` or `fr`)
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`: Set to enable Plausible analytics
- `CONTACT_TO_EMAIL`: Recipient for contact emails (falls back to `content/site.json` contact email if unset)
- `CONTACT_FROM_EMAIL`: Optional default "from" address if different from the recipient
- `RESEND_API_KEY` or `SMTP_*`: Configure at least one mail provider
- `RESEND_FROM_EMAIL`: Verified sender when using Resend (falls back to `CONTACT_FROM_EMAIL`)
- `HCAPTCHA_SECRET`/`NEXT_PUBLIC_HCAPTCHA_SITE_KEY` or `TURNSTILE_SECRET`/`NEXT_PUBLIC_TURNSTILE_SITE_KEY`: Enable bot protection (set both the secret and site key for a provider to activate verification)
- `SHEET_WEBHOOK_URL`: Optional Google Sheets webhook to append new submissions

### Commands

| Script | Description |
| --- | --- |
| `npm run dev` | Start local development server |
| `npm run lint` | Lint code with ESLint |
| `npm run typecheck` | Run TypeScript checks |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run analyze` | Analyze production bundle |
| `npm run test:e2e` | Execute Playwright smoke tests |

### Localization

Localized strings live in `public/locales/{en,fr}/common.json`. Keys are grouped by feature (`nav`, `sections`, `contact`, etc.). When adding new UI copy:

1. Add the key to the English file first.
2. Mirror the entry in the French file.
3. Reference the key in your component via `useTranslations`.

Structured marketing content (hero, services, process, portfolio) is stored in `content/site.json` for quick edits without code changes.

### Contentlayer / MDX

Legal pages are authored as MDX inside `content/mdx/legal`. Each file defines front matter for `title`, `slug`, and `locale`. Contentlayer generates typed data so you can import docs in React components.

To add a new MDX page:

1. Create a file under `content/mdx/<section>/<slug>.<locale>.mdx`.
2. Include the required front matter (`title`, `locale`, `slug`).
3. Query via `allLegalDocs` or configure a new document type in `contentlayer.config.ts`.

### Adding a Portfolio Item

1. Edit `content/site.json` and append to the `portfolio` array. Provide `title`, localized descriptions, tags, and link.
2. Add an optional image under `public/images/portfolio/` and update the map in `components/portfolio.tsx` if needed.
3. Re-run `npm run dev` or `npm run build` to see the update.

### Contact Form Pipeline

- Client-side: `components/contact-form.tsx` validates input with Zod and handles hCaptcha or Turnstile if configured.
- API route: `app/api/contact/route.ts` re-validates, verifies captcha tokens, sends emails via Resend or SMTP, and forwards payloads to the optional Sheets webhook.

### Deployment

Deploy to Vercel:

1. Import the repository into Vercel.
2. Set environment variables in the Vercel dashboard.
3. Enable `npm run build` as the build command (default).
4. Ensure Contentlayer builds by keeping the `next-contentlayer` plugin enabled in `next.config.mjs`.

Vercel automatically handles image optimization and edge middleware for locale routing.

### Testing

Run the Playwright suite locally:

```bash
npm run test:e2e
```

This spins up `npm run dev`, executes smoke tests covering localization, the contact form, structured data, and viewport checks.

CI (`.github/workflows/ci.yml`) runs linting, type-checking, and `next build` on pushes and pull requests.

## Accessibility & SEO

- Skip-to-content link, focus styles, and semantic landmarks are included.
- Metadata and Open Graph tags are localized per page.
- JSON-LD defines Organization, Service, CreativeWork, WebSite, and Breadcrumb schemas.
- CSP, HSTS, Referrer-Policy, Permissions-Policy, and X-Content-Type-Options headers are configured in `next.config.mjs`.
