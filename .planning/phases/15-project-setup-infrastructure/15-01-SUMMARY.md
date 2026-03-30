---
phase: 15-project-setup-infrastructure
plan: 01
subsystem: infra
tags: [nextjs, tailwind-v4, metro, ssg, framer-motion, lucide-react]

requires: []
provides:
  - "Next.js 15 project at /website with SSG static export"
  - "Tailwind v4 + framer-motion + lucide-react dependencies"
  - "Metro blockList isolating /website from Expo bundler"
  - "Root tsconfig excluding website/ from type checking"
  - "Convenience scripts website:dev and website:build"
affects: [16-landing-page-content, 17-deployment-seo]

tech-stack:
  added: [next@16.2.1, tailwindcss@4, framer-motion, lucide-react]
  patterns: [ssg-static-export, metro-blocklist-isolation, monorepo-prefix-scripts]

key-files:
  created:
    - website/package.json
    - website/next.config.ts
    - website/app/layout.tsx
    - website/app/page.tsx
    - website/app/globals.css
    - website/components/Header.tsx
    - website/components/Footer.tsx
    - metro.config.js
  modified:
    - tsconfig.json
    - package.json

key-decisions:
  - "Used create-next-app scaffold with Tailwind v4 (not v3) — new @import syntax"
  - "SSG output: 'export' with unoptimized images for static hosting"
  - "Metro blockList spreads existing entries to preserve Expo internal exclusions"

patterns-established:
  - "Website isolation: separate node_modules, no workspace linking, excluded from root tsc"
  - "Convenience scripts via npm --prefix website pattern"

requirements-completed: [SETUP-01, SETUP-02, SETUP-03]

duration: 4min
completed: 2026-03-30
---

# Phase 15 Plan 01: Project Setup & Infrastructure Summary

**Next.js 15 project scaffolded at /website with SSG export, Tailwind v4, Motion/Lucide deps, and full Metro/TypeScript isolation from Expo app**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T16:47:52Z
- **Completed:** 2026-03-30T16:51:45Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Next.js 15 project at /website with App Router, TypeScript, Tailwind v4, and SSG static export
- framer-motion and lucide-react installed for Phase 16 landing page animations
- Metro blockList regex prevents Expo from resolving Next.js modules
- Root tsconfig and package.json patched for clean monorepo coexistence

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 15 project and customize for Dwella** - `adccf34` (feat)
2. **Task 2: Create Metro blockList and patch root configs** - `0ef1634` (feat)

## Files Created/Modified
- `website/package.json` - Next.js project manifest with framer-motion and lucide-react
- `website/next.config.ts` - SSG static export configuration
- `website/app/layout.tsx` - Root layout shell with Dwella metadata
- `website/app/page.tsx` - Minimal placeholder page
- `website/app/globals.css` - Tailwind v4 import + Dwella brand CSS variables
- `website/components/Header.tsx` - Navigation placeholder for Phase 16
- `website/components/Footer.tsx` - Footer placeholder for Phase 16
- `metro.config.js` - Metro bundler config with website blockList
- `tsconfig.json` - Added "website" to exclude array
- `package.json` - Added website:dev and website:build convenience scripts

## Decisions Made
- Used create-next-app scaffold with Tailwind v4 (new `@import "tailwindcss"` syntax, not v3 directives)
- SSG `output: 'export'` with `unoptimized: true` for static hosting compatibility
- Metro blockList spreads existing entries to preserve Expo internal exclusions
- Answered "No" to React Compiler and AGENTS.md prompts during scaffold

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- `website/components/Header.tsx` - Navigation links placeholder (Phase 16 will implement)
- `website/components/Footer.tsx` - Footer content placeholder (Phase 16 will implement)
- `website/app/layout.tsx` - Header/footer comments in JSX (Phase 16 will wire components)

These stubs are intentional -- they establish file structure for Phase 16 content implementation.

## Issues Encountered

- `create-next-app` prompted interactively for React Compiler and AGENTS.md options (not covered by CLI flags). Resolved by piping `yes N` to auto-answer.
- Pre-existing TypeScript error in `app/_layout.tsx` (tuple destructuring) unrelated to this plan's changes. Not fixed per scope boundary rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- /website builds successfully to static HTML in out/ directory
- Header, Footer, and page components ready for Phase 16 content
- framer-motion and lucide-react available for animations and icons
- Root Expo pipeline fully isolated from website

## Self-Check: PASSED

All 8 key files verified present. Both task commits (adccf34, 0ef1634) found in git log.

---
*Phase: 15-project-setup-infrastructure*
*Completed: 2026-03-30*
