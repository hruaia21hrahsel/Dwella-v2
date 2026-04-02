---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Dwella Landing Page
status: executing
stopped_at: "Checkpoint: Task 2 TestFlight human verification (18-02)"
last_updated: "2026-04-02T15:30:02.239Z"
last_activity: 2026-04-02
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 4
  completed_plans: 3
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-30)

**Core value:** Every user-facing workflow (auth, property CRUD, payments, invites, documents, maintenance, reports, bot) works correctly and securely.
**Current focus:** Phase 18 — apple-app-store-beta-testing-prep

## Current Position

Phase: 18 (apple-app-store-beta-testing-prep) — EXECUTING
Plan: 2 of 2
Status: Ready to execute
Last activity: 2026-04-02

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity (v1.2 reference):**

- Total plans completed: 9
- Average duration: ~5 min
- Total execution time: ~45 min

## Accumulated Context

### Decisions

- [v1.3]: Android Play Store launch deferred to v1.4 — landing page takes priority
- [v1.3]: Next.js 15 + Tailwind v4 + App Router chosen for /website — SSG via `output: 'export'`
- [v1.3]: /website is fully isolated — no workspaces, no shared node_modules, no root tsconfig extension
- [v1.3]: Dwella brand palette (indigo #4F46E5) canonical — discard teal #009688 from old landing/index.html
- [v1.3]: Privacy policy in Phase 16 (not Phase 17) — it is a hard blocker for app store submission, not launch polish
- [v1.3]: Contact section uses mailto: link (not Resend Route Handler) — keeps site fully static, no server-side code
- [Phase 18]: ascAppId hardcoded in eas.json submit.production.ios — enables non-interactive eas submit
- [Phase 18]: privacyManifests NSPrivacyAccessedAPICategoryUserDefaults/CA92.1 added to app.json — required by App Store review

### Pending Todos

None.

### Blockers/Concerns

- [Phase 16]: OG image (1200x630) is a design asset — must be created before Phase 17 SEO verification can complete
- [Phase 16]: Play Store URL must be confirmed live before Android download badge is hardcoded (iOS confirmed: id6760478576)
- [carry over]: PLAT-05 (Sentry) and PLAT-03 (App Links) decisions deferred to v1.4
- [carry over]: iOS UpdateGate [APP_ID], pg_cron schedule verification, invite-redirect store URLs still pending pre-launch

### Roadmap Evolution

- Phase 18 added: Apple App Store Beta Testing Prep — Configure EAS Build, app.json metadata, bundle ID, provisioning, and TestFlight submission readiness

## Session Continuity

Last session: 2026-04-02T15:30:02.235Z
Stopped at: Checkpoint: Task 2 TestFlight human verification (18-02)
Resume file: None
