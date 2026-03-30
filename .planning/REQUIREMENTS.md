# Requirements: Dwella v1.3 — Dwella Landing Page

**Defined:** 2026-03-30
**Core Value:** Every user-facing workflow (auth, property CRUD, payments, invites, documents, maintenance, reports, bot) works correctly and securely.

## v1.3 Requirements

Requirements for a marketing landing page built with Next.js, deployed on Vercel.

### Setup & Infrastructure

- [x] **SETUP-01**: Next.js 15 project scaffolded in `/website` with its own `package.json` and `tsconfig.json`, isolated from the Expo app
- [x] **SETUP-02**: Metro config updated with blockList to exclude `/website` directory from mobile builds
- [x] **SETUP-03**: Root `tsconfig.json` excludes `website/` from Expo type checking
- [ ] **SETUP-04**: Vercel project configured with `website` as root directory and Ignored Build Step to prevent unnecessary deploys

### Content Pages

- [ ] **PAGE-01**: Hero section with app tagline, description, and call-to-action pointing to app store downloads
- [ ] **PAGE-02**: Feature highlights section showcasing key app capabilities (property management, payments, maintenance, reports)
- [ ] **PAGE-03**: App screenshot gallery with real app screenshots in device mockup frames
- [ ] **PAGE-04**: App store download badges (iOS App Store + Google Play) linking to store listings
- [ ] **PAGE-05**: Privacy policy page at `/privacy` with full legal text (required for app store submissions)
- [ ] **PAGE-06**: Contact/support section with mailto link to support email

### Design & Branding

- [ ] **BRAND-01**: Responsive layout working on mobile, tablet, and desktop viewports
- [ ] **BRAND-02**: Design uses Dwella indigo (#4F46E5) brand palette consistently
- [ ] **BRAND-03**: Smooth scroll animations using Motion library

### SEO & Deployment

- [ ] **SEO-01**: Meta tags and Open Graph tags with `metadataBase` configured for social sharing
- [ ] **SEO-02**: OG image (1200x630) created and serving correctly on social platforms
- [ ] **SEO-03**: Sitemap and robots.txt generated via Next.js built-in routes
- [ ] **SEO-04**: Site deployed and accessible on Vercel subdomain (dwella.vercel.app or similar)

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Landing Page Enhancements

- **LP-01**: AI bot showcase section (dedicated differentiator section)
- **LP-02**: Testimonials section (once real user feedback is available)
- **LP-03**: Pricing page (if subscription model is added)
- **LP-04**: Blog/changelog section
- **LP-05**: Custom domain configuration

### Android Play Store (Deferred from original v1.3)

- **BUILD-01**: App is signed with a production release keystore via EAS credentials
- **BUILD-02**: eas.json has Android-specific production build config
- **STORE-01**: Play Store listing has 4+ screenshots
- **STORE-02**: Play Store listing has feature graphic (1024x500px)
- **STORE-03**: Play Store listing has app title, description, and feature bullets
- **PLAT-01**: Google OAuth configured for Android
- **PLAT-02**: Unused Android permissions removed
- **PLAT-03**: App Links assetlinks.json deployed
- **PLAT-04**: PostHog production env wired
- **PLAT-05**: Sentry reinstalled or removed
- **VERIFY-01**: App launches and authenticates on physical Android device
- **VERIFY-02**: Push notifications received on physical Android device
- **VERIFY-03**: Deep links resolve correctly on Android

## Out of Scope

| Feature | Reason |
|---------|--------|
| Contact form with email delivery | mailto: link is sufficient for MVP; Resend integration deferred |
| AI bot showcase section | Differentiator but not table stakes; future enhancement |
| Web version of the app | Landing page is marketing only, not a web app |
| Testimonials | No real user feedback available yet |
| Custom domain | Starting with Vercel subdomain; trivial to add later |
| Android Play Store submission | Deferred to v1.4 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 15 | Complete |
| SETUP-02 | Phase 15 | Complete |
| SETUP-03 | Phase 15 | Complete |
| SETUP-04 | Phase 15 | Pending |
| PAGE-01 | Phase 16 | Pending |
| PAGE-02 | Phase 16 | Pending |
| PAGE-03 | Phase 16 | Pending |
| PAGE-04 | Phase 16 | Pending |
| PAGE-05 | Phase 16 | Pending |
| PAGE-06 | Phase 16 | Pending |
| BRAND-01 | Phase 16 | Pending |
| BRAND-02 | Phase 16 | Pending |
| BRAND-03 | Phase 16 | Pending |
| SEO-01 | Phase 17 | Pending |
| SEO-02 | Phase 17 | Pending |
| SEO-03 | Phase 17 | Pending |
| SEO-04 | Phase 17 | Pending |

**Coverage:**
- v1.3 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-03-30*
*Traceability updated: 2026-03-30 (roadmap created)*
