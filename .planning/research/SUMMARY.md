# Project Research Summary

**Project:** Dwella v2 — v1.3 Marketing Landing Page
**Domain:** Next.js marketing landing page integrated into React Native / Expo monorepo
**Researched:** 2026-03-30
**Confidence:** HIGH

## Executive Summary

Dwella v1.3 adds a marketing landing page — a standalone Next.js 15 app living in `/website` at the repo root. This is not a monorepo with shared packages; it is an isolated Next.js project that shares only brand colors (duplicated as constants) with the Expo app. The recommended approach is complete build pipeline separation: the Expo app builds via EAS to the app stores, while the Next.js site builds via Vercel pointing at the `/website` root directory. No Turborepo, no npm workspaces, no shared `node_modules`. This simplicity is the correct call — there is zero code to share between the two build systems.

The most important deliverable for this milestone is the privacy policy page at `/privacy`. Apple App Store and Google Play both require a live, publicly accessible privacy policy URL before app submission will be approved. This is a hard blocker and must be deployed before any store submission begins. The rest of the landing page — hero, feature highlights, screenshots, store download badges, and contact section — follows established SaaS landing page patterns with no novel research challenges.

The primary risks are all in the project setup phase, not the feature implementation phase. TypeScript config isolation (preventing Metro and Next.js from reading each other's configs), React version pinning (avoiding dual instances from workspace hoisting), and Vercel's "Ignored Build Step" configuration (preventing every React Native commit from triggering a website rebuild) must all be addressed in Phase 1. Defer the Vercel "Ignored Build Step" and the project will likely hit the free tier's 100-deploy/day limit within weeks. Get the config right upfront and the rest of the build is routine.

---

## Key Findings

### Recommended Stack

The new stack lives entirely within `/website` and does not touch the existing Expo dependencies. Next.js 15 with the App Router is the correct choice for 2026 — it provides SSG via `output: 'export'`, a built-in SEO metadata API (no `next-sitemap` plugin needed), and Tailwind CSS v4 integration out of the box via `create-next-app`. The contact form uses React Hook Form + Zod for client-side validation and Resend for email delivery via a Route Handler — a pattern with official Next.js integration support. See `.planning/research/STACK.md` for full detail.

**Core technologies:**
- **Next.js 15.2.4** — React framework + static site generation — current stable; App Router is the standard path in 2026
- **React 19.x** — required by Next.js 15; must be kept isolated from Expo's React version via separate `node_modules`
- **Tailwind CSS v4** — styling — CSS-native config, up to 10x faster builds than v3, default in `create-next-app` for 2026
- **TypeScript 5.x** — type safety — matches existing Expo codebase discipline
- **`motion` 12.x (optional)** — scroll-reveal animations — import from `motion/react`, successor to Framer Motion
- **React Hook Form 7.x + Zod 3.x** — contact form validation — uncontrolled components, zero re-renders
- **Resend 4.x** — contact form email delivery — 3,000/month free tier, 8-minute setup vs SendGrid's 45
- **Vercel Hobby** — deployment — free plan covers a static marketing site indefinitely

### Expected Features

The feature research is clear and well-prioritized. Privacy policy, hero, screenshots, and download badges are P1 — non-negotiable for launch. The AI bot differentiator callout deserves its own dedicated section: no major competitor (Buildium, TurboTenant, Innago) has an AI bot, making it Dwella's clearest differentiator. FAQ, comparison table, and trust signals are P2/P3 and can follow launch once traffic data reveals which objections to address. See `.planning/research/FEATURES.md` for the full prioritization matrix.

**Must have (table stakes):**
- Hero section with value proposition, sub-headline, App Store / Play Store CTA buttons
- App Store and Google Play download badges linked to live store listings
- Privacy policy page at `/privacy` — legally required for App Store and Play Store submission; must be live before any store review
- App screenshots in device frames (3-5 screens showing core workflows)
- Feature highlights section (6 features with icons and descriptions covering landlord + tenant value)
- Responsive mobile-first layout — majority of marketing traffic arrives on mobile
- SEO metadata: title, description, `og:image` (1200x630), JSON-LD SoftwareApplication schema
- Brand alignment: indigo `#4F46E5` palette, Dwella logo

**Should have (competitive):**
- AI bot differentiator callout — Dwella's clearest differentiator; no major competitor has this; deserves its own section
- Dual-role explainer (landlord column + tenant column) — unique positioning vs single-role property tools
- Contact / support email — trust signal; visitors need a way to reach someone before downloading
- Security trust signals (RLS policies, secure auth, PIN/biometric) — landlords handle sensitive financial data
- FAQ section — 5-8 questions covering free tier, platforms, privacy, invite flow, bot setup

**Defer (v2+):**
- Blog / content marketing — requires ongoing investment and a defined content strategy
- Live demo / sandbox environment — high ops cost (separate Supabase environment, seed data, reset logic)
- Pricing page — Dwella is not yet a paid SaaS product; a pricing page implies a subscription that does not exist
- Real user testimonials — app is pre-launch; fabricated testimonials are a trust liability

### Architecture Approach

The architecture is deliberately simple: `/website` is a self-contained Next.js project with its own `package.json`, `node_modules`, and `tsconfig.json`. It extends nothing from the repo root. The Expo project at the root excludes `website` from both its TypeScript config and Metro bundler via a `blockList`. Vercel deploys are scoped to the `/website` root directory. The existing `/landing/index.html` is the content reference — all copy, links, and app store IDs come from it — but the implementation is rebuilt as proper Next.js components using Tailwind, the Next.js metadata API, and `next/image`. See `.planning/research/ARCHITECTURE.md` for file-level build order.

**Major components:**
1. `website/app/layout.tsx` — root metadata (`metadataBase`, OG tags, fonts, global CSS)
2. `website/app/page.tsx` — home page assembling HeroSection, FeatureGrid, AppStoreBadges, Footer
3. `website/app/privacy/page.tsx` — privacy policy as a static Server Component (full HTML at `view-source:`, no JS required)
4. `website/components/` — HeroSection, FeatureGrid, AppStoreBadges, NavBar, Footer (Server Components by default; only interactive fragments are Client Components)
5. `metro.config.js` (repo root, new) — `blockList` excluding `/website` and `/landing` from Metro's file resolution graph
6. Root `tsconfig.json` (modified) — `"exclude": ["website"]` preventing root tsc from scanning Next.js files

### Critical Pitfalls

1. **Vercel rebuilds on every React Native commit** — configure "Ignored Build Step" (`git diff HEAD^ HEAD --quiet -- website/`) on first deploy; without this, mobile-only commits burn free tier quota and clutter deployment history

2. **TypeScript config conflict between Expo and Next.js** — `website/tsconfig.json` must NOT extend the root config; root `tsconfig.json` must exclude `website`; validate with `npx tsc --noEmit` from both directories independently before writing any components

3. **React version mismatch from workspace hoisting** — do NOT register `website` in root `workspaces`; it must have its own isolated `node_modules` with a separately installed React; check `npm ls react` from `website/` shows a single version

4. **`metadataBase` not set — OG images resolve to localhost** — set `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dwella.app')` in `layout.tsx`; verify with Twitter Card Validator and Facebook Debugger against the production URL, not localhost

5. **`"use client"` applied to entire page components** — turns static HTML into client-rendered JavaScript, degrading SEO and Core Web Vitals; only interactive fragments (mobile menu toggle, animated sections) should be Client Components; confirm `next build` output shows `○ /` (static), not `λ /` (server-rendered)

---

## Implications for Roadmap

Based on the combined research, a 3-phase structure maps cleanly to the dependency order established in ARCHITECTURE.md and the pitfall-to-phase mapping from PITFALLS.md. All critical pitfalls cluster in Phase 1 (setup). All content belongs in Phase 2. All launch validation belongs in Phase 3.

### Phase 1: Project Setup and Infrastructure

**Rationale:** Every critical pitfall identified in PITFALLS.md is a setup-phase problem. TypeScript isolation, Metro blockList, React version pinning, and Vercel configuration must be correct before any component is written. Fixing these after implementation is significantly more expensive than doing them first. The existing `/landing/index.html` provides the live App Store ID (`id6760478576`), Play Store URL, and copy to reference during scaffolding.

**Delivers:** Working `/website` scaffold with Next.js 15 and Tailwind v4; isolated `tsconfig.json` that does not extend the root; `metro.config.js` at repo root with blockList for `/website` and `/landing`; root `tsconfig.json` updated with `"exclude": ["website"]`; `.gitignore` updated with `website/.next/`, `website/out/`, `website/node_modules/`; Vercel project created with Root Directory set to `website` and Ignored Build Step configured; brand colors duplicated into `website/tailwind.config.ts`; shared assets (icon, favicon, logo) copied into `website/public/`

**Avoids:** Pitfall 1 (Vercel over-deployment), Pitfall 2 (tsconfig conflict), Pitfall 3 (React version mismatch) — all are Phase 1 problems per PITFALLS.md mapping

### Phase 2: Core Pages and Components

**Rationale:** With infrastructure correct, all content can be built. Privacy policy is in this phase — not Phase 3 — because it is the App Store submission blocker and has zero upstream dependencies once the scaffold exists. Hero, feature highlights, screenshots, and download badges are the primary conversion drivers and belong in the same phase so the site can be deployed as a coherent unit.

**Delivers:** Home page with hero section, feature highlights, AI bot differentiator callout, dual-role explainer, app screenshots in device frames, download badges, contact email section; privacy policy at `/privacy` (static Server Component with full text at `view-source:`); responsive mobile-first layout (tested at 375px and 390px); `metadataBase` set in root layout; SEO metadata (title, description, og:image, JSON-LD SoftwareApplication); `next/font/google` for self-hosted fonts; contact form (either Resend-backed Route Handler or simple `mailto:` — decision in Phase 2 planning)

**Uses:** `motion/react` for scroll-reveal animations on feature cards (optional); `next/image` with `priority` prop on hero image; React Hook Form + Zod + Resend if full contact form is in scope

**Implements:** HeroSection, FeatureGrid, AppStoreBadges, Footer, NavBar (all Server Components by default); ContactForm (Client Component only for the form interaction state)

**Avoids:** Pitfall 4 (metadataBase missing), Pitfall 5 (use client overuse) — per PITFALLS.md Phase 2 verification checklist

### Phase 3: SEO, Performance Validation, and Launch

**Rationale:** The "looks done but isn't" checklist from PITFALLS.md requires the production URL to exist before it can be executed. OG image verification via social debuggers, sitemap submission to Google Search Console, robots.txt validation, App Store link testing on real devices, and Lighthouse performance scoring all require a live deployment. These cannot be validated in development or on preview URLs.

**Delivers:** Production deployment at custom domain; OG image verified via Twitter Card Validator and Facebook Debugger; `sitemap.xml` confirmed valid and submitted to Google Search Console; `robots.txt` disallowing Vercel preview URLs and allowing production domain; App Store (iOS) and Play Store (Android) links tested on real devices; Lighthouse mobile performance score above 90, LCP under 2.5s; `/landing` directory deleted after live deployment confirmed; `X-Frame-Options: DENY` header verified in Vercel response

**Addresses:** JSON-LD SoftwareApplication schema (P2 from FEATURES.md); hero image `priority` prop (performance trap from PITFALLS.md); font subsetting via `next/font/google`; `sitemap.ts` and `robots.ts` built-in Next.js generation

**Avoids:** OG image broken in production (Pitfall 4 verification), no sitemap indexed (Google crawl delay), App Store links broken on mobile — all Phase 3 verification items per PITFALLS.md

### Phase Ordering Rationale

- Infrastructure before content: every critical pitfall (tsconfig conflict, React version mismatch, Vercel config) must be resolved before component development starts. Retrofitting isolation after pages are written requires ripping out imports and reconfiguring tools mid-stream.
- Privacy policy in Phase 2 (not Phase 3): the privacy policy is not a "launch polish" item — it is required before App Store submission. Treating it as an afterthought delays the entire v1.3 milestone.
- SEO verification requires production URL: OG image validation, sitemap indexing, and real-device link testing cannot happen locally or on preview URLs. These belong at the end when the production domain is configured.
- Delete `/landing` last: only after Vercel confirms the production deployment is live and all links work should the old static HTML be removed. The existing file contains the live App Store ID (`id6760478576`) and Play Store URL — values the new site depends on.

### Research Flags

Phases with standard patterns (no additional research needed):

- **Phase 1:** Fully documented. Metro `blockList` with `exclusionList`, TypeScript project isolation, and Vercel root directory configuration all have official documentation at HIGH confidence. No ambiguity in implementation.
- **Phase 2:** Standard Next.js App Router page composition. `motion/react`, React Hook Form, and Resend all have official Next.js integration guides. No novel patterns required.
- **Phase 3:** Standard deployment verification checklist. All tools (Twitter Card Validator, Facebook Debugger, Google Search Console, Lighthouse) are well-known. No additional research needed.

No phases require a `/gsd:research-phase` invocation. Research coverage is complete for all three phases.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against official docs. Next.js 15.2.4 confirmed via official release blog. Tailwind v4 has an official Next.js integration guide. Motion 12.x official docs updated March 2026. Resend has official Next.js integration guide. |
| Features | HIGH | Apple App Store review guidelines consulted directly for privacy policy requirement. Competitor analysis (Buildium, TurboTenant, Innago) via WebSearch. Multiple SaaS landing page benchmark sources cross-verified. |
| Architecture | HIGH | Metro `blockList`/`exclusionList` sourced from official Metro docs. Vercel root directory and Ignored Build Step from official Vercel monorepo docs. `output: 'export'` from official Next.js static export docs. |
| Pitfalls | HIGH | Each critical pitfall cross-verified: Vercel Ignored Build Step from official docs and community post-mortems. tsconfig conflict from Expo monorepo guide and Next.js docs. `metadataBase` requirement from official Next.js metadata API docs. |

**Overall confidence:** HIGH

### Gaps to Address

- **Brand color discrepancy:** The existing `/landing/index.html` uses `#009688` (teal) as the primary brand color, but `PROJECT.md` and `constants/colors.ts` both specify `#4F46E5` (indigo). ARCHITECTURE.md flags this explicitly. Before building Phase 2 components, confirm which color is canonical — do not carry the teal forward into the new site.

- **App Store badge readiness:** FEATURES.md notes that download badges require live store listings. The existing HTML has a confirmed iOS App Store ID (`id6760478576`). The Play Store URL must be confirmed before wiring up the Android badge. During Phase 1, verify both store URLs are live and resolve correctly before hardcoding them.

- **Contact form scope decision:** STACK.md recommends a full Resend-backed Route Handler. PITFALLS.md explicitly notes a simple `mailto:` link is acceptable for MVP. Resolve this during Phase 2 planning — a `mailto:` reduces scope, eliminates the `RESEND_API_KEY` environment variable dependency, and removes the only server-side code from an otherwise fully static site.

- **og:image asset creation:** All research assumes a 1200x630 branded OG image exists as a static asset in `website/public/`. This is a design task, not an engineering task. It must be created before Phase 3 SEO verification. Flag this as an explicit dependency for whoever handles design assets — the Phase 3 social debugger verification cannot complete without it.

---

## Sources

### Primary (HIGH confidence)

- Next.js 15 Release Blog (nextjs.org/blog/next-15) — React 19 requirement, Turbopack stable, async APIs
- Next.js Metadata API docs (nextjs.org/docs/app/api-reference/functions/generate-metadata) — `generateMetadata`, `metadataBase`, `sitemap.ts`, `robots.ts`
- Tailwind CSS v4 Upgrade Guide + Next.js integration guide (tailwindcss.com) — v4 architecture, PostCSS integration, official Next.js install guide
- Motion for React official docs (motion.dev/docs/react) — import path `motion/react`, version 12.x
- React Hook Form official docs (react-hook-form.com) — version 7.x, uncontrolled components
- Resend Next.js integration guide (resend.com/nextjs) — Route Handler pattern, free tier limits
- Vercel Pricing (vercel.com/pricing) — Hobby plan limits, custom domain support
- Vercel Monorepos documentation (vercel.com/docs/monorepos) — Root Directory setting, Ignored Build Step pattern
- Expo Monorepos guide (docs.expo.dev/guides/monorepos) — Metro watchFolders, SDK 52+ behavior
- Metro bundler configuration docs (metrobundler.dev/docs/configuration) — `blockList`, `exclusionList` helper
- Apple App Store Review Guidelines (developer.apple.com/app-store/review/guidelines) — privacy policy live URL requirement
- Apple App Store Marketing Guidelines (developer.apple.com/app-store/marketing/guidelines) — official badge assets and usage rules
- Next.js static export docs (nextjs.org) — `output: 'export'`, `trailingSlash`, `images.unoptimized`

### Secondary (MEDIUM confidence)

- Next.js 15.2.4 version confirmation (abhs.in) — third-party blog, version number cross-checked
- Resend vs SendGrid 2026 (dev.to) — community DX comparison
- Migrate from next-sitemap to App Directory sitemap (mikebifulco.com) — confirms built-in is sufficient for new projects
- SaaS landing page best practices 2026 — Fibr AI, Veza Digital, Lovable (multiple community sources, cross-verified)
- App Store screenshot size requirements 2025 (splitmetrics.com) — ASO guide
- Next.js SEO pitfalls (focusreactive.com) — client-side rendering SEO failure patterns
- Vercel monorepo deployment patterns (dev.to/gdbroman) — Ignored Build Step community post-mortem
- Monorepo React Native + Next.js coexistence (tyhopp.com) — single source, aligns with known Expo behavior

---

*Research completed: 2026-03-30*
*Ready for roadmap: yes*
