# Roadmap: Dwella v2

## Milestones

- ✅ **v1.0 Launch Audit & Hardening** — Phases 1-5 (shipped 2026-03-19)
- ✅ **v1.1 Tools Expansion** — Phases 6-10 (shipped 2026-03-21)
- ✅ **v1.2 WhatsApp Bot** — Phases 11-14 (shipped 2026-03-21)
- 🚧 **v1.3 Android Play Store Launch** — Phases 15-17 (in progress)

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

### 🚧 v1.3 Android Play Store Launch (In Progress)

**Milestone Goal:** Ship Dwella to Google Play Store with production signing, all platform config wired, and the app verified on a physical Android device.

- [ ] **Phase 15: Build, Signing & Platform Config** - EAS production keystore, Android permissions cleanup, Google OAuth, App Links, PostHog/Sentry config, and privacy policy linked
- [ ] **Phase 16: Store Listing Assets** - Screenshots, feature graphic, and store copy submitted in Play Console (user-driven manual tasks)
- [ ] **Phase 17: Android Verification** - End-to-end device testing confirming auth, push notifications, and deep links work on physical Android

## Phase Details

### Phase 15: Build, Signing & Platform Config
**Goal**: The app builds with a production-signed Android binary and all platform configuration is correct before submission
**Depends on**: Phase 14
**Requirements**: BUILD-01, BUILD-02, STORE-04, PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05
**Success Criteria** (what must be TRUE):
  1. `eas build --platform android --profile production` completes without credential errors and produces a signed AAB
  2. Privacy policy is reachable at a public URL and that URL is set in `app.json` under `android.privacyPolicyUrl`
  3. Google OAuth sign-in works end-to-end (Google Cloud Console OAuth client + Supabase Google provider both configured with the production package name)
  4. `AndroidManifest.xml` contains no `RECORD_AUDIO` or `SYSTEM_ALERT_WINDOW` permission entries
  5. Sentry is either fully configured with a real DSN and capturing events, or all Sentry imports and calls are removed with no remaining build-time references
**Plans**: TBD

### Phase 16: Store Listing Assets
**Goal**: The Play Store listing is complete and ready for review submission
**Depends on**: Phase 15
**Requirements**: STORE-01, STORE-02, STORE-03
**Success Criteria** (what must be TRUE):
  1. Play Console shows at least 4 screenshots uploaded covering key app screens (properties list, payment flow, bot chat, notifications)
  2. Feature graphic (1024x500px) is uploaded and visible in the Play Console listing preview
  3. App title, short description, and full description with feature bullets are saved in Play Console with no placeholder text remaining
**Plans**: TBD

### Phase 17: Android Verification
**Goal**: The production build is confirmed working on a physical Android device across all critical user paths
**Depends on**: Phase 16
**Requirements**: VERIFY-01, VERIFY-02, VERIFY-03
**Success Criteria** (what must be TRUE):
  1. App installs and launches to the onboarding screen on a physical Android device running the production build
  2. Email/password login, Google OAuth login, and navigation between tabs all complete without errors on the physical device
  3. A push notification sent from Supabase is received and tapped on the physical Android device and routes to the correct screen
  4. Tapping a `dwella://` deep link on the physical Android device opens the correct in-app screen
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
| 15. Build, Signing & Platform Config | v1.3 | 0/TBD | Not started | - |
| 16. Store Listing Assets | v1.3 | 0/TBD | Not started | - |
| 17. Android Verification | v1.3 | 0/TBD | Not started | - |
