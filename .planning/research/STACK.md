# Technology Stack

**Project:** Dwella v2 — v1.3 Marketing Landing Page
**Researched:** 2026-03-30
**Confidence:** HIGH
**Scope:** NEW capabilities only. Existing stack (Expo SDK 54, Supabase, Claude API, Zustand, Victory Native) is validated and unchanged. This file covers only the `/website` Next.js addition.

---

## Executive Finding

The landing page lives in `/website` as a **standalone Next.js app** — no monorepo tooling required, no Turborepo, no workspaces. It shares zero runtime code with the Expo app. The connection is visual only: Dwella brand colors and assets. This keeps the Expo `package.json` clean and the website independently deployable.

Total new dependencies: **6 production + 4 dev**.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.2.4 | React framework + SSG | Current stable. App Router (not Pages Router) is the standard path in 2025-2026. Turbopack included for fast dev. Built-in `generateMetadata`, `sitemap.ts`, `robots.ts` mean zero third-party SEO dependencies. |
| React | 19.x | UI runtime | Required by Next.js 15. No choice here — use what `create-next-app` bootstraps. |
| TypeScript | 5.x | Type safety | Consistent with existing Expo codebase which has zero TS errors. The landing page should match. |
| Tailwind CSS | 4.x | Styling | v4 is the correct default for new projects in 2026. No `tailwind.config.js` file — configuration lives in CSS via `@theme` directives. Up to 10x faster builds than v3. PostCSS plugin: `@tailwindcss/postcss`. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `motion` | 12.x | Scroll-reveal and entrance animations | Use for hero section fade-in, feature card stagger, and section entrance animations. Import from `motion/react` (not the old `framer-motion` package, though both work). Only add `motion` if animations are needed — do not add for purely static sections. |
| `react-hook-form` | 7.x | Contact/waitlist form state | Use for the contact or waitlist form. Uncontrolled components, no re-renders, zero dependencies, 27.9 kB. Pair with `zod` + `@hookform/resolvers` for schema validation. |
| `zod` | 3.x | Form schema validation | Shared between client (RHF) and Server Action — same schema validates on both sides. |
| `@hookform/resolvers` | 3.x | RHF + Zod bridge | Connects RHF's `useForm` to a Zod resolver. One import. |
| `resend` | 4.x | Contact form email delivery | Use to deliver contact form submissions to a Dwella inbox. The `resend` npm package wraps their API. Free tier: 3,000 emails/month, 100/day. Modern DX — setup in 8 minutes vs. SendGrid's 45. React Email integration if you want styled confirmation emails. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@tailwindcss/postcss` | Tailwind v4 PostCSS integration | Required by Tailwind v4 — replaces the v3 `tailwindcss` PostCSS plugin. |
| ESLint + `eslint-config-next` | Linting | Included by `create-next-app`. Do not add extra plugins — the Next.js ESLint config already covers React and accessibility rules. |
| TypeScript strict mode | Type checking | Set `"strict": true` in `/website/tsconfig.json`. Match existing Expo app discipline. |
| Vercel CLI | Local preview + deployment | `npx vercel --cwd website` to preview before pushing. Free for the Hobby plan which covers a marketing site. |

---

## Installation

Run these commands from the `/website` directory after `npx create-next-app@latest website --typescript --eslint --app --tailwind`:

```bash
# From /website directory

# Animation (add only if you build animated sections)
npm install motion

# Form handling
npm install react-hook-form zod @hookform/resolvers

# Email delivery for contact form
npm install resend
```

Tailwind CSS v4 and its PostCSS integration are included automatically by `create-next-app` when you pass `--tailwind`. No separate install needed.

---

## Directory Structure

```
/website                      ← standalone Next.js app, its own package.json
  app/
    layout.tsx                ← root metadata (title, OG, metadataBase)
    page.tsx                  ← landing page (Hero + Features + Download + Contact)
    privacy/
      page.tsx                ← Privacy Policy (required for App Store)
    api/
      contact/
        route.ts              ← Server Route: validates form, calls Resend
    sitemap.ts                ← auto-generates sitemap.xml
    robots.ts                 ← auto-generates robots.txt
  components/
    Hero.tsx
    Features.tsx
    DownloadBadges.tsx
    ContactForm.tsx
  public/
    screenshots/              ← App Store screenshot PNGs
    og-image.png              ← 1200x630 OG image
  package.json                ← independent of root Expo package.json
  next.config.ts
  tsconfig.json
```

The root `package.json` and `node_modules` are **untouched**. Metro (Expo's bundler) will not see the `/website` directory.

---

## Monorepo Approach: Subdirectory, Not Workspaces

**Decision: Simple subdirectory. No Turborepo. No `pnpm workspaces`.**

Rationale:
- No shared code between the Expo app and the website. They share brand colors only — copy the hex values, do not create a shared package.
- Turborepo is worthwhile when you have shared packages (e.g., `packages/ui`, `packages/config`). Without shared packages it adds complexity with zero benefit.
- The root `package.json` uses `npm`. Adding workspaces would require either converting to a monorepo workspace or using pnpm — both break existing Expo tooling in ways that require Metro reconfiguration.
- Vercel deploys the `/website` subdirectory independently by setting the `Root Directory` to `website` in the Vercel project settings.

**Git root remains at `/`** — one repo, one `.git`, one remote. The `/website` directory is just another directory in the tree.

---

## SEO: Built-in, No Third-Party Plugins

**Decision: Use Next.js 15's built-in metadata system. Do not install `next-sitemap`.**

Next.js 15 App Router provides:
- `export const metadata: Metadata` in any `layout.tsx` / `page.tsx` — static title, description, OG tags, Twitter cards
- `generateMetadata()` — dynamic metadata for routes that need it (not needed here — this is a static marketing site)
- `app/sitemap.ts` — exports a typed function returning `MetadataRoute.Sitemap`; Next.js serializes to XML at `/sitemap.xml`
- `app/robots.ts` — exports `MetadataRoute.Robots`; served at `/robots.txt`

All three are zero-dependency, generated at build time, and work correctly with Vercel's CDN edge cache. `next-sitemap` is a post-build process that was necessary before these built-ins existed; it is no longer needed for new projects.

**Set `metadataBase` in root layout** — without it, OG image URLs are relative paths that social platforms cannot fetch.

---

## Animation: Motion for React (Optional but Recommended)

**Decision: Use `motion` from `motion/react`. Add only if the design calls for animated entrances.**

The library was rebranded from Framer Motion to Motion in late 2024. Both `framer-motion` and `motion` packages exist on npm; new projects should use `motion`. Current version: 12.x (12.38.0 as of March 2026).

Use cases on a marketing page:
- Hero headline fade-up on load
- Feature card stagger on scroll into view (use `whileInView` + `viewport={{ once: true }}`)
- Section entrance animations

Do **not** use CSS animations for these — Motion's `whileInView` with `viewport={{ once: true }}` is simpler, more controllable, and avoids the `IntersectionObserver` boilerplate.

**Server Component constraint:** `motion` components are Client Components. Wrap only the animated parts in `'use client'` boundaries. Keep the page shell and `layout.tsx` as Server Components to preserve SEO benefits.

---

## Form Handling: React Hook Form + Zod + Resend Server Route

**Decision: RHF on the client, Zod on client + server, Resend in a Next.js Route Handler.**

Pattern:
1. `ContactForm.tsx` (`'use client'`) — RHF `useForm` with `zodResolver`
2. On submit: `POST /api/contact` with form data
3. `app/api/contact/route.ts` (Server) — validates again with same Zod schema, calls `resend.emails.send()`
4. Success/error state returned to client

**Do not use Next.js Server Actions for the contact form.** Server Actions are the right choice for data mutations in authenticated apps. For a public contact form on a marketing page, a simple Route Handler (`POST /api/contact`) is more debuggable, more testable, and easier to rate-limit if needed.

**Resend free tier** is sufficient for a marketing site: 3,000 emails/month, 100/day. The `resend` npm SDK is 4.x, under active development. Uses the same `RESEND_API_KEY` environment variable on Vercel.

---

## Deployment: Vercel

**Decision: Vercel Hobby plan. Root directory set to `website`.**

Configuration in Vercel project settings:
- **Root Directory:** `website`
- **Build Command:** `next build` (default)
- **Output Directory:** `.next` (default)
- **Framework Preset:** Next.js (auto-detected)

Vercel Hobby plan limits relevant to a marketing site:
- 100 deployments/day — more than sufficient
- 100 GB Fast Data Transfer/month — fine for a static site
- Static pages are served from the edge CDN at no function invocation cost
- The contact form Route Handler counts as a serverless function invocation: 1M/month free

**Custom domain:** Add in Vercel project settings. Point DNS `CNAME` to `cname.vercel-dns.com`. No extra cost on Hobby for custom domains.

**Vercel Pro is not needed** until/unless the site scales beyond 100 GB/month transfer or you need team collaboration features.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Next.js 15 (App Router) | Astro | Astro is excellent for pure content sites with zero JavaScript. Dwella's contact form and animations require React. Next.js is the obvious choice when the team already knows React. |
| Next.js 15 (App Router) | Next.js 14 (Pages Router) | Pages Router is legacy. App Router is the default since Next.js 13. No reason to start a new project on the old router. |
| Tailwind CSS v4 | Tailwind CSS v3 | "There is zero reason to start with v3 in 2026." v4 is faster, CSS-native, and is now the default in `create-next-app`. |
| Tailwind CSS v4 | CSS Modules | CSS Modules have no productivity advantage over Tailwind for a 3-5 page marketing site. Tailwind's utility classes are faster for rapid layout work. |
| `motion` | CSS transitions only | CSS is fine for hover states. Motion's `whileInView` is irreplaceable for scroll-triggered entrance animations without IntersectionObserver boilerplate. |
| React Hook Form | Formik | Formik is effectively unmaintained (last commit >1 year ago). RHF has 2x the npm downloads and is under active development. |
| Resend | SendGrid | SendGrid setup takes 45 minutes and requires domain verification + SMTP config. Resend is designed for React/Next.js developers: setup in 8 minutes, free tier covers a marketing site indefinitely. |
| Simple subdirectory | Turborepo monorepo | Turborepo adds value only when you have shared packages. With zero shared packages between Expo and Next.js, Turborepo is pure overhead. |
| Built-in `sitemap.ts` | `next-sitemap` package | `next-sitemap` was a workaround before Next.js added native sitemap support. Use the built-in — it's typed, requires no post-build step, and is one less dependency. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `next-sitemap` | Unnecessary post-build dependency — Next.js 15 has native `sitemap.ts` and `robots.ts` support | `app/sitemap.ts` (built-in) |
| Formik | Unmaintained. Last release >1 year ago. 2x fewer downloads than React Hook Form | `react-hook-form` |
| `react-spring` | Heavy bundle for spring physics. Overkill for a marketing page with entrance animations | `motion` (framer-motion) |
| `@vercel/analytics` | Adds JavaScript tracking overhead. Dwella already uses PostHog in the app. For a simple marketing page, no analytics is fine unless you need download click tracking. | None, or add PostHog snippet later |
| Turborepo / pnpm workspaces | Unnecessary complexity with no shared packages between Expo and Next.js | Simple subdirectory with independent `package.json` |
| `styled-components` / Emotion | Server Component incompatible without complex setup. CSS-in-JS has been largely superseded by Tailwind for new projects | Tailwind CSS v4 |
| `gray-matter` / MDX | Only add if blog posts are in scope. They are not. | Not needed |
| `next-themes` | Dark mode toggling is not in scope for a marketing page. Dwella's app handles dark mode separately. | Not needed |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 15.2.4 | React 19.x | React 19 is required (not just compatible) by Next.js 15 |
| Tailwind CSS v4 | Next.js 15 | Official guide at tailwindcss.com/docs/guides/nextjs confirms v4 + Next.js 15 support |
| `motion` 12.x | React 19 | Tested against Next.js 16 / React 19 in March 2026 — no breaking changes |
| `react-hook-form` 7.x | React 19 | Works with React 19 `useActionState` pattern; can coexist with Server Actions |
| `zod` 3.x | TypeScript 5.x | No issues. Zod 4 is in development but 3.x is stable and widely used |
| Resend 4.x | Next.js 15 Route Handlers | Official Next.js integration guide on resend.com/nextjs |

---

## Environment Variables

Add to Vercel project (website scope only — do NOT add to Expo EAS env):

| Variable | Value | Where Set |
|----------|-------|-----------|
| `RESEND_API_KEY` | From Resend dashboard | Vercel project settings > Environment Variables |
| `CONTACT_EMAIL` | Email address to receive contact form submissions | Vercel project settings > Environment Variables |

The website does **not** need Supabase credentials. It is a public marketing page with no authenticated database access.

---

## Sources

- [Next.js 15.2.4 Current Stable](https://www.abhs.in/blog/nextjs-current-version-march-2026-stable-release-whats-new) — version confirmation (MEDIUM confidence — third-party)
- [Next.js 15 Release Blog](https://nextjs.org/blog/next-15) — React 19 requirement, Turbopack stable, async APIs (HIGH confidence — official)
- [Next.js Metadata API — generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) — SEO built-ins (HIGH confidence — official docs)
- [Next.js sitemap.xml built-in](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap) — native sitemap support (HIGH confidence — official docs)
- [Tailwind CSS v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide) — v4 architecture changes, CSS-native config (HIGH confidence — official docs)
- [Tailwind CSS v4 + Next.js install guide](https://tailwindcss.com/docs/guides/nextjs) — official integration (HIGH confidence — official docs)
- [Motion for React (framer-motion rebrand)](https://motion.dev/docs/react) — import from `motion/react`, version 12.x (HIGH confidence — official)
- [Should I use Framer Motion or Motion One?](https://motion.dev/blog/should-i-use-framer-motion-or-motion-one) — React integration recommendation (HIGH confidence — official)
- [React Hook Form](https://react-hook-form.com/) — uncontrolled components, 7.x stable (HIGH confidence — official)
- [Resend Next.js integration](https://resend.com/nextjs) — official Next.js guide (HIGH confidence — official)
- [Resend vs SendGrid 2026](https://dev.to/theawesomeblog/resend-vs-sendgrid-2026-which-email-api-actually-ships-faster-dg8) — DX comparison (MEDIUM confidence — community)
- [Vercel Pricing 2026](https://vercel.com/pricing) — Hobby plan limits (HIGH confidence — official)
- [Expo Monorepos Guide](https://docs.expo.dev/guides/monorepos/) — confirmed no Metro reconfiguration needed with SDK 52+ for monorepo (HIGH confidence — official Expo docs)
- [Migrate from next-sitemap to App Directory sitemap](https://mikebifulco.com/posts/migrate-from-next-sitemap-to-app-directory-sitemap) — confirms built-in is sufficient (MEDIUM confidence — community)

---

*Stack research for: Next.js marketing landing page in Expo monorepo*
*Researched: 2026-03-30*
