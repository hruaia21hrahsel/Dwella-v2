# Requirements: Dwella v1.3 — Android Play Store Launch

**Defined:** 2026-03-29
**Core Value:** Every user-facing workflow (auth, property CRUD, payments, invites, documents, maintenance, reports, bot) works correctly and securely.

## v1.3 Requirements

Requirements for Android Play Store submission. Each maps to roadmap phases.

### Build & Signing

- [ ] **BUILD-01**: App is signed with a production release keystore via EAS credentials
- [ ] **BUILD-02**: eas.json has Android-specific production build config with credentialsSource

### Store Listing

- [ ] **STORE-01**: Play Store listing has 4+ screenshots showing key app features
- [ ] **STORE-02**: Play Store listing has feature graphic (1024x500px)
- [ ] **STORE-03**: Play Store listing has app title, description, and feature bullets
- [ ] **STORE-04**: Privacy policy is published at a public URL and linked in app.json

### Platform Config

- [ ] **PLAT-01**: Google OAuth is configured in Google Cloud Console and linked in Supabase
- [ ] **PLAT-02**: Unused Android permissions (RECORD_AUDIO, SYSTEM_ALERT_WINDOW) are removed
- [ ] **PLAT-03**: App Links assetlinks.json is generated and deployed for verified deep linking
- [ ] **PLAT-04**: PostHog API key is added to eas.json production env (or explicitly disabled)
- [ ] **PLAT-05**: Sentry crash monitoring is reinstalled and configured, or deliberately removed with cleanup

### Verification

- [ ] **VERIFY-01**: App launches, authenticates (email + Google + Apple), and navigates on a physical Android device
- [ ] **VERIFY-02**: Push notifications are received on physical Android device
- [ ] **VERIFY-03**: Deep links (dwella://) resolve correctly on Android

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### iOS App Store

- **IOS-01**: iOS App Store ID configured in UpdateGate.tsx
- **IOS-02**: iOS App Store listing and submission

### Backend Hardening

- **BACK-01**: pg_cron schedule verification in Supabase dashboard
- **BACK-02**: pdf-reports Storage bucket creation
- **BACK-03**: HTML2PDF_API_KEY set as Supabase secret

## Out of Scope

| Feature | Reason |
|---------|--------|
| iOS App Store submission | Separate milestone — different platform requirements |
| New user-facing features | v1.3 is infrastructure/config only |
| Unit test suite | Post-launch recommendation (tracked in PROJECT.md) |
| Supabase backend changes | No migrations needed for Play Store launch |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUILD-01 | Phase 15 | Pending |
| BUILD-02 | Phase 15 | Pending |
| STORE-01 | Phase 16 | Pending |
| STORE-02 | Phase 16 | Pending |
| STORE-03 | Phase 16 | Pending |
| STORE-04 | Phase 15 | Pending |
| PLAT-01 | Phase 15 | Pending |
| PLAT-02 | Phase 15 | Pending |
| PLAT-03 | Phase 15 | Pending |
| PLAT-04 | Phase 15 | Pending |
| PLAT-05 | Phase 15 | Pending |
| VERIFY-01 | Phase 17 | Pending |
| VERIFY-02 | Phase 17 | Pending |
| VERIFY-03 | Phase 17 | Pending |

**Coverage:**
- v1.3 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 — traceability mapped after roadmap creation*
