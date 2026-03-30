# Phase 15: Project Setup & Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 15-project-setup-infrastructure
**Areas discussed:** Next.js scaffold choices, Build isolation strategy, Vercel deploy config, Dev workflow

---

## Next.js Scaffold Choices

### Scaffold Method

| Option | Description | Selected |
|--------|-------------|----------|
| create-next-app | Run `npx create-next-app@latest website` — official starter with App Router, Tailwind v4, TypeScript pre-wired | ✓ |
| Manual setup | Create package.json from scratch, install next/react/tailwind manually | |

**User's choice:** create-next-app (Recommended)
**Notes:** Fastest path to a working scaffold with all standard tooling.

### Extra Dependencies

| Option | Description | Selected |
|--------|-------------|----------|
| Motion (framer-motion) | BRAND-03 requires smooth scroll animations — install now | ✓ |
| Heroicons or Lucide icons | Phase 16 feature highlights need icons | ✓ |
| None — bare minimum | Only Next.js + React + Tailwind | |

**User's choice:** Motion + icon library
**Notes:** Pre-install to have dependencies ready for Phase 16.

### Icon Library

| Option | Description | Selected |
|--------|-------------|----------|
| Lucide React | Tree-shakeable, lightweight, modern design. ~1000 icons. | ✓ |
| Heroicons | By Tailwind team. Clean minimal style, ~300 icons. | |
| You decide | Claude picks | |

**User's choice:** Lucide React (Recommended)
**Notes:** None

### Layout Shell

| Option | Description | Selected |
|--------|-------------|----------|
| Basic shell | Minimal layout.tsx with header/footer placeholders and Dwella brand color in globals.css | ✓ |
| Blank slate | Just the default Next.js page | |

**User's choice:** Basic shell (Recommended)
**Notes:** Confirms the build works with real structure.

---

## Build Isolation Strategy

### Metro Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Create metro.config.js | New file extending expo/metro-config with website/ in blockList | ✓ |
| Use app.json metro config | Configure via app.json (less common) | |

**User's choice:** Create metro.config.js (Recommended)
**Notes:** Standard Expo pattern for monorepo isolation.

### Root Scripts

| Option | Description | Selected |
|--------|-------------|----------|
| Convenience scripts | Add `website:dev` and `website:build` to root package.json | ✓ |
| Keep root clean | Developers cd into /website manually | |
| You decide | Claude picks | |

**User's choice:** Yes — convenience scripts (Recommended)
**Notes:** Quick access without cd-ing.

---

## Vercel Deploy Config

### Ignored Build Step

| Option | Description | Selected |
|--------|-------------|----------|
| Bash git diff check | `git diff --quiet HEAD^ HEAD ./website` — skip if no website/ changes | ✓ |
| Environment variable | Custom env var logic | |
| You decide | Claude picks | |

**User's choice:** Bash git diff check (Recommended)
**Notes:** Simple and reliable.

### Config Location

| Option | Description | Selected |
|--------|-------------|----------|
| vercel.json in /website | Commit framework/build settings as code | ✓ |
| Dashboard only | All config in Vercel UI | |
| You decide | Claude picks | |

**User's choice:** vercel.json in /website (Recommended)
**Notes:** Reproducible, version-controlled. Dashboard only for secrets and domain.

---

## Dev Workflow

### Shared Tooling

| Option | Description | Selected |
|--------|-------------|----------|
| Fully independent | Own ESLint/Prettier config, no shared config with Expo app | ✓ |
| Share Prettier config | Symlink or reference root .prettierrc | |
| You decide | Claude picks | |

**User's choice:** Fully independent (Recommended)
**Notes:** Matches the "no shared anything" isolation principle.

### Dev Server Port

| Option | Description | Selected |
|--------|-------------|----------|
| Default 3000 | Next.js default, no conflict with Expo 8081 | ✓ |
| Custom port (3001) | Explicit port in dev script | |
| You decide | Claude picks | |

**User's choice:** Default 3000 (Recommended)
**Notes:** No conflict expected.

---

## Claude's Discretion

- Specific Next.js version pinning within the v15 range
- ESLint rule configuration within /website
- Exact vercel.json settings beyond framework and output config

## Deferred Ideas

None — discussion stayed within phase scope
