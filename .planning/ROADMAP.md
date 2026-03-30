# Roadmap: Dwella v2

## Milestones

- ✅ **v1.0 Launch Audit & Hardening** — Phases 1-5 (shipped 2026-03-19)
- ✅ **v1.1 Tools Expansion** — Phases 6-10 (shipped 2026-03-21)
- ✅ **v1.2 WhatsApp Bot** — Phases 11-14 (shipped 2026-03-21)
- 🚧 **v1.3 Dwella Landing Page** — Phases 15-17 (in progress)

## Phases

<details>
<summary>✅ v1.0 Launch Audit & Hardening (Phases 1-5) — SHIPPED 2026-03-19</summary>

- [x] Phase 1: Compilation & Tooling Baseline (4/4 plans) — completed 2026-03-18
- [x] Phase 2: Security & Data Integrity (4/4 plans) — completed 2026-03-18
- [x] Phase 3: Edge Functions & Backend (2/2 plans) — completed 2026-03-19
- [x] Phase 4: Client Code & UX (2/2 plans) — completed 2026-03-19
- [x] Phase 5: Launch Configuration & Store Gate (2/2 plans) — completed 2026-03-19

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Tools Expansion (Phases 6-10) — SHIPPED 2026-03-21</summary>

- [x] Phase 6: AI Tools Removal (1/1 plans) — completed 2026-03-20
- [x] Phase 7: Document Storage (4/4 plans) — completed 2026-03-21
- [x] Phase 8: Maintenance Requests (4/4 plans) — completed 2026-03-21
- [x] Phase 9: Reporting Dashboards (4/4 plans) — completed 2026-03-21
- [x] Phase 10: Maintenance Wiring Fixes (1/1 plans) — completed 2026-03-21

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 WhatsApp Bot (Phases 11-14) — SHIPPED 2026-03-21</summary>

- [x] Phase 11: Setup & Infrastructure (2/2 plans) — completed 2026-03-21
- [x] Phase 12: Media Handling (2/2 plans) — completed 2026-03-21
- [x] Phase 13: Rich Messaging & Menus (3/3 plans) — completed 2026-03-21
- [x] Phase 14: Intents & Outbound Notifications (2/2 plans) — completed 2026-03-21

Full details: `.planning/milestones/v1.2-ROADMAP.md`

</details>

### 🚧 v1.3 Dwella Landing Page (In Progress)

**Milestone Goal:** Build and deploy a marketing landing page for Dwella using Next.js in `/website`, isolated from the Expo build pipeline, hosted on Vercel, with all content pages live including the privacy policy required for app store submissions.

- [ ] **Phase 15: Project Setup & Infrastructure** - Next.js 15 scaffold in `/website` with full build pipeline isolation (Metro blockList, tsconfig exclusion, Vercel config)
- [ ] **Phase 16: Core Pages & Branding** - All content pages built (hero, features, screenshots, download badges, privacy policy, contact) with Dwella brand palette and responsive layout
- [ ] **Phase 17: SEO & Launch** - OG image, sitemap, robots.txt, and production deployment verified on Vercel subdomain

## Phase Details

### Phase 15: Project Setup & Infrastructure
**Goal**: The `/website` Next.js project exists, builds independently, and is completely isolated from the Expo app's build pipeline before any component work begins
**Depends on**: Phase 14
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04
**Success Criteria** (what must be TRUE):
  1. Running `npm run build` inside `/website` produces a static export without errors and without touching any Expo or React Native files
  2. Running `npx tsc --noEmit` from the repo root completes without errors caused by Next.js files — the root TypeScript config excludes `website/`
  3. Starting the Expo dev server (`npx expo start`) produces no Metro resolution errors related to `/website` — the blockList is active
  4. Vercel project exists with Root Directory set to `website` and Ignored Build Step configured so mobile-only commits do not trigger website rebuilds
**Plans**: TBD

### Phase 16: Core Pages & Branding
**Goal**: Visitors can see the full landing page with all content sections and navigate to the privacy policy — the site is deployable and app-store-submission-ready
**Depends on**: Phase 15
**Requirements**: PAGE-01, PAGE-02, PAGE-03, PAGE-04, PAGE-05, PAGE-06, BRAND-01, BRAND-02, BRAND-03
**Success Criteria** (what must be TRUE):
  1. The home page shows a hero section with tagline, description, and app store download CTA buttons linked to the live iOS and Android store listings
  2. The home page shows a feature highlights section covering property management, payments, maintenance, and reports with icons and descriptions
  3. The home page shows app screenshots displayed in device mockup frames
  4. The privacy policy is accessible at `/privacy` and renders its full legal text without requiring JavaScript (visible at `view-source:`)
  5. The site renders correctly at 375px (mobile), 768px (tablet), and 1280px (desktop) viewports with no layout overflow or broken elements
  6. All branded elements use the Dwella indigo (#4F46E5) palette and scroll animations are visible on feature cards
**Plans**: TBD
**UI hint**: yes

### Phase 17: SEO & Launch
**Goal**: The site is live on a public Vercel URL with working social sharing previews, a valid sitemap, and all SEO metadata confirmed correct in production
**Depends on**: Phase 16
**Requirements**: SEO-01, SEO-02, SEO-03, SEO-04
**Success Criteria** (what must be TRUE):
  1. Pasting the production URL into the Twitter Card Validator and Facebook Debugger shows the correct OG title, description, and 1200x630 OG image — no "localhost" references appear
  2. `https://<domain>/sitemap.xml` returns a valid XML sitemap listing the home page and privacy policy URLs
  3. `https://<domain>/robots.txt` returns a valid robots.txt that allows crawling of the production domain
  4. The site is accessible at a live Vercel subdomain (e.g., `dwella.vercel.app`) and the privacy policy URL at `/privacy` is publicly reachable for app store submission
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Compilation & Tooling Baseline | v1.0 | 4/4 | Complete | 2026-03-18 |
| 2. Security & Data Integrity | v1.0 | 4/4 | Complete | 2026-03-18 |
| 3. Edge Functions & Backend | v1.0 | 2/2 | Complete | 2026-03-19 |
| 4. Client Code & UX | v1.0 | 2/2 | Complete | 2026-03-19 |
| 5. Launch Configuration & Store Gate | v1.0 | 2/2 | Complete | 2026-03-19 |
| 6. AI Tools Removal | v1.1 | 1/1 | Complete | 2026-03-20 |
| 7. Document Storage | v1.1 | 4/4 | Complete | 2026-03-21 |
| 8. Maintenance Requests | v1.1 | 4/4 | Complete | 2026-03-21 |
| 9. Reporting Dashboards | v1.1 | 4/4 | Complete | 2026-03-21 |
| 10. Maintenance Wiring Fixes | v1.1 | 1/1 | Complete | 2026-03-21 |
| 11. Setup & Infrastructure | v1.2 | 2/2 | Complete | 2026-03-21 |
| 12. Media Handling | v1.2 | 2/2 | Complete | 2026-03-21 |
| 13. Rich Messaging & Menus | v1.2 | 3/3 | Complete | 2026-03-21 |
| 14. Intents & Outbound Notifications | v1.2 | 2/2 | Complete | 2026-03-21 |
| 15. Project Setup & Infrastructure | v1.3 | 0/TBD | Not started | - |
| 16. Core Pages & Branding | v1.3 | 0/TBD | Not started | - |
| 17. SEO & Launch | v1.3 | 0/TBD | Not started | - |
