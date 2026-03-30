# Feature Research

**Domain:** Marketing landing page for a property management mobile app (React Native / Expo)
**Researched:** 2026-03-30
**Confidence:** HIGH (multi-source cross-verified: Apple developer docs, SaaS landing page benchmarks, property management competitor analysis, WebSearch)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that visitors assume exist on a mobile app landing page. Missing any of these makes the product look unfinished or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Hero section with value proposition | First 3–5 seconds must communicate what the app does and for whom | LOW | Headline under 8 words, sub-headline explains features. Include primary CTA (App Store / Google Play download). |
| App store download badges (iOS + Android) | Users need a direct path to install; no badge = no conversion | LOW | Apple provides official badge assets with usage guidelines. Link to actual store listings. Badges repeat at bottom of page. |
| App screenshots / mockups | Visitors must see the product before downloading — standard expectation | MEDIUM | 3–5 screens showing core workflows (dashboard, payments, bot). Use device frames. Provide mobile-optimised sizes. |
| Feature highlights section | Users need to understand what the app does beyond the hero | LOW | 3–6 cards or rows, each feature with icon, title, 1-sentence description. Covers landlord + tenant dual-role value. |
| Privacy policy page | **Required by Apple App Store and Google Play** — app will be rejected without a live URL | LOW | Separate `/privacy` route. Covers data collected, storage, retention, third parties (Supabase, Claude, PostHog, Sentry). SSG rendered. |
| Contact / support section | Users expect a way to reach support before downloading | LOW | Email address or contact form. Links to support channel (email is sufficient for v1.3). |
| Responsive design (mobile-first) | Over 60% of marketing traffic arrives on mobile — unusable on phone = high bounce | MEDIUM | Next.js + Tailwind handles this cleanly. Hero layout must stack vertically on mobile. Screenshots scale down. |
| Correct branding (logo, color, typography) | Mismatch between landing page and app destroys trust | LOW | Use existing Dwella brand: `#4F46E5` indigo primary, dark/light palette. Match app's CRED Premium aesthetic. |
| Page title, meta description, og:image | Baseline SEO — missing these tanks search ranking and social shares | LOW | Next.js App Router `metadata` export. og:image should be 1200×630 branded image. |
| Fast load time (Core Web Vitals pass) | Google ranks slow pages lower; users bounce off slow pages | MEDIUM | Next.js SSG with Image optimisation resolves most issues. No blocking scripts. Tailwind purges unused CSS. |

---

### Differentiators (Competitive Advantage)

Features that go beyond the baseline and make the landing page more convincing.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI bot callout section | Dwella's AI-powered Telegram/WhatsApp bot is a genuine differentiator vs Buildium/AppFolio — most competitors don't have it | LOW | Dedicated section. Explain natural language queries, interactive menus, proactive notifications. Show bot conversation screenshot. |
| Dual-role explainer (landlord + tenant) | Most property apps target one role — Dwella serves both from one account | LOW | Split visual: left column landlord benefits, right column tenant benefits. Reinforces inclusivity of the product. |
| Feature comparison table vs manual tracking | Converts users who currently use spreadsheets — largest market segment | MEDIUM | Compare columns: "Spreadsheet / WhatsApp group" vs "Dwella". Rows: payment tracking, maintenance requests, documents, reminders. |
| Screenshots with context captions | Unlabelled screenshots leave users guessing — captions convert | LOW | 1-line caption per screenshot. E.g. "Track payments and mark proof of payment." |
| Security / trust signals section | Landlords handle sensitive financial and personal data — trust is a buying factor | LOW | Mention: end-to-end RLS policies, secure auth (Apple/Google), PIN/biometric lock, Sentry crash monitoring. |
| FAQ section | Reduces pre-download objections without requiring support contact | LOW | 5–8 questions: free vs paid, platform compatibility, data privacy, how tenant invite works, bot setup. |
| Structured data (JSON-LD) | Rich result eligibility in Google search (SoftwareApplication schema) | LOW | `SoftwareApplication` with `operatingSystem: iOS, Android`, `applicationCategory: BusinessApplication`, `offers`. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features to explicitly not build for v1.3.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Live demo / sandbox environment | Prospects want to try before installing | Requires maintaining a separate demo Supabase environment, seed data, and reset logic — high ops cost | Rich screenshots and an app preview video in the hero achieve the same goal without infrastructure |
| Pricing page | Users want to know cost upfront | Dwella is not yet a paid SaaS product — listing pricing implies a subscription model that doesn't exist yet | If app is free, state "Free on iOS and Android" in the hero CTA. No pricing page needed. |
| Blog / content marketing section | Good for SEO long-term | Content strategy requires ongoing investment; v1.3 scope is one landing page — not a content platform | Defer to post-launch when content strategy is defined |
| User account creation / web sign-up form | Converts web visitors to app users | Creates a second auth entry point disconnected from the Expo app — data sync complexity is non-trivial | Direct all CTAs to App Store / Play Store badges |
| Testimonials / social proof from real users | Builds trust immediately | App is pre-launch or early beta — fabricated testimonials are a trust liability, real testimonials aren't available yet | Substitute with feature/benefit statements, security trust signals, and "Built for independent landlords" positioning |
| Cookie consent banner / GDPR popup | Legal compliance | The landing page is SSG with no tracking cookies — Vercel Analytics is cookieless by default. An unnecessary consent popup creates friction | Only add if non-cookieless analytics are used. PostHog in the mobile app does not affect the landing page. |
| Animation-heavy hero (Framer Motion, parallax) | "Looks premium" | Adds JS bundle weight, can fail Core Web Vitals, adds build complexity with no proven conversion lift | Clean CSS transitions are sufficient. Investment should go to copy and screenshots, not motion. |

---

## Feature Dependencies

```
App Store download badges
    └──requires──> Live App Store listing (iOS) — store URL must exist
    └──requires──> Live Play Store listing (Android) — store URL must exist
    └──NOTE──> Badges can be "Coming soon" placeholders if store listings aren't live yet

Privacy policy page (/privacy)
    └──required by──> Apple App Store submission (live URL in App Store Connect)
    └──required by──> Google Play submission
    └──NOTE──> Must be live BEFORE app store submission; not optional

Hero CTA buttons
    └──depends on──> App store download badges (links to store)
    └──enhances──> Screenshots section (reinforces install decision)

Feature highlights
    └──depends on──> Brand colors / design system (from existing app constants)
    └──enhances──> Dual-role explainer (same feature set, dual audience framing)

SEO metadata (og:image, JSON-LD)
    └──requires──> Branded og:image asset (1200×630px)
    └──requires──> App Store listing URL (for JSON-LD offers)
    └──depends on──> Next.js App Router metadata export

Contact section
    └──no external dependencies
    └──NOTE──> Email is sufficient — no form submission backend needed for v1.3

AI bot callout
    └──no external dependencies (screenshots + copy only)
    └──depends on──> App screenshots of bot conversation for visual

FAQ section
    └──no external dependencies
    └──NOTE──> Implement as static accordion component; no CMS needed
```

### Dependency Notes

- **Privacy policy requires live URL before app store submission:** This is the single hardest blocker for App Store review. The `/privacy` page must be deployed before submitting to Apple or Google.
- **App store badges require live listings:** Use placeholder badges with `#` href until store URLs are known. Swap to real URLs at launch.
- **SEO metadata depends on og:image asset:** This needs to be created (a branded 1200×630 image) — it is not auto-generated. Must be included as a static asset in `/public/`.

---

## MVP Definition

### Launch With (v1.3)

Minimum viable landing page — what is needed for the App Store submission and first visitors.

- [ ] Hero section with value proposition headline, sub-headline, and App Store / Play Store CTA buttons — why essential: first thing every visitor sees
- [ ] App screenshots section (3–5 screens in device frames) — why essential: primary conversion driver for mobile apps
- [ ] Feature highlights section (6 key features, icons + descriptions) — why essential: answers "what does it actually do?"
- [ ] AI bot differentiator callout — why essential: single biggest differentiator vs competitors; deserves its own section
- [ ] Privacy policy page at `/privacy` — why essential: **required for App Store and Play Store submission, not optional**
- [ ] Contact / support email — why essential: trust signal; visitors need a way to reach someone
- [ ] Responsive mobile layout — why essential: majority of landing page traffic is mobile
- [ ] SEO metadata (title, description, og:image, JSON-LD) — why essential: affects search ranking and social share appearance
- [ ] Brand alignment (indigo `#4F46E5` palette, Dwella logo) — why essential: mismatch between landing page and app destroys trust

### Add After Validation (v1.x)

Features to add once the base landing page is live and traffic data is available.

- [ ] FAQ section — add when support emails cluster around the same questions
- [ ] Feature comparison table (Dwella vs spreadsheet) — add when user interviews confirm spreadsheet users as primary audience
- [ ] Security / trust signals section — add if conversion data shows trust drop-off
- [ ] Terms of service page — add before any monetisation or subscription features
- [ ] Real user testimonials — add when 5+ users provide genuine quotes

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Blog / content marketing — defer until content strategy is resourced
- [ ] Live demo environment — defer until a maintainable sandbox architecture is designed
- [ ] Pricing page — defer until subscription model is defined
- [ ] Changelog / release notes page — defer until regular release cadence is established

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Hero section + CTA | HIGH | LOW | P1 |
| App Store / Play Store badges | HIGH | LOW | P1 |
| Privacy policy page | HIGH (legal) | LOW | P1 |
| App screenshots section | HIGH | MEDIUM | P1 |
| Feature highlights | HIGH | LOW | P1 |
| Responsive layout | HIGH | MEDIUM | P1 |
| SEO metadata + og:image | HIGH | LOW | P1 |
| AI bot callout | MEDIUM | LOW | P2 |
| Dual-role explainer | MEDIUM | LOW | P2 |
| Contact section | MEDIUM | LOW | P2 |
| Security trust signals | MEDIUM | LOW | P2 |
| FAQ section | MEDIUM | LOW | P2 |
| Comparison table | MEDIUM | MEDIUM | P3 |
| JSON-LD structured data | LOW | LOW | P2 |

**Priority key:**
- P1: Must have for launch — page is broken or legally non-compliant without it
- P2: Should have — meaningfully improves conversion or trust
- P3: Nice to have — adds value but safe to defer

---

## Competitor Feature Analysis

Landing page patterns observed on Buildium, TurboTenant, and Innago (leading independent landlord tools).

| Feature | Buildium | TurboTenant | Innago | Our Approach |
|---------|----------|-------------|--------|--------------|
| Hero CTA | "Get a demo" | "Try free" | "Get started free" | "Download on iOS / Android" — mobile-first, no web sign-up |
| Primary audience messaging | Mid-size PM companies | Independent landlords | Small landlords, free tier | Independent landlords — dual-role (also serves tenants) |
| Social proof | Customer logos, review badges | Star ratings, testimonial quotes | User count ("10,000+ landlords") | Defer testimonials; use security signals + feature copy instead |
| Screenshots | Product dashboard screenshots | Mobile app screenshots | Dashboard screenshots | Mobile app screenshots in device frames (matches Dwella's mobile nature) |
| Pricing transparency | Tiered pricing table | Free tier prominent | Free prominent | "Free to download" — no pricing complexity to explain |
| Privacy policy | Linked in footer | Linked in footer | Linked in footer | Separate `/privacy` route, also linked in footer |
| AI / bot feature | Not present | Not present | Not present | Dedicated section — key differentiator |

**Insight:** No major competitor prominently features an AI bot. This is Dwella's clearest differentiator and should receive a dedicated above-the-fold or near-above-the-fold section.

---

## Sources

- Apple App Review Guidelines — privacy policy requirement: https://developer.apple.com/app-store/review/guidelines/ (HIGH confidence)
- Apple App Store marketing guidelines (badge usage): https://developer.apple.com/app-store/marketing/guidelines/ (HIGH confidence)
- SaaS landing page best practices 2026 — Fibr AI: https://fibr.ai/landing-page/saas-landing-pages (MEDIUM confidence)
- SaaS landing page design patterns 2026 — Veza Digital: https://www.vezadigital.com/post/best-saas-landing-page-examples (MEDIUM confidence)
- Property management landing page elements — Four and Half: https://fourandhalf.com/5-elements-killer-landing-pages-property-managers/ (MEDIUM confidence)
- Landing page conversion best practices 2026 — Lovable: https://lovable.dev/guides/landing-page-best-practices-convert (MEDIUM confidence)
- Next.js SEO best practices 2025 — Slatebytes: https://www.slatebytes.com/articles/next-js-seo-in-2025-best-practices-meta-tags-and-performance-optimization-for-high-google-rankings (MEDIUM confidence)
- SaaS landing page trends 2026 — SaaSFrame: https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples (MEDIUM confidence)
- TurboTenant competitor profile: https://www.turbotenant.com (observed via WebSearch)
- Innago vs competitor comparison: https://innago.com/comparing-innago-vs-the-competition/ (MEDIUM confidence)
- App Store screenshot size requirements 2025: https://splitmetrics.com/blog/app-store-screenshots-aso-guide/ (HIGH confidence)

---

*Feature research for: Dwella v2 v1.3 milestone — Marketing Landing Page*
*Researched: 2026-03-30*
