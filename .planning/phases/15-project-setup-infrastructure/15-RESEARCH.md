# Phase 15: Project Setup & Infrastructure - Research

**Researched:** 2026-03-30
**Domain:** Next.js 15 project scaffolding, Expo Metro isolation, Vercel deployment configuration
**Confidence:** HIGH

## Summary

This phase creates a fully isolated Next.js 15 project at `/website` within an existing Expo monorepo-like structure (no workspaces). The work falls into four clearly bounded tasks: scaffold the Next.js project, patch Metro to ignore `/website`, patch root `tsconfig.json` to exclude `website/`, and configure a Vercel project with a smart Ignored Build Step.

All locked decisions (D-01 through D-10, D-CF1 through D-CF3) are confirmed technically sound. The Metro `blockList` approach works cleanly via regex on the absolute path. The Vercel `git diff HEAD^ HEAD --quiet -- .` command (run from the `website` root directory context) is the official documented pattern. Next.js 15 SSG via `output: 'export'` is stable and unchanged since v14.

**Primary recommendation:** Use `create-next-app@latest` with `--app --typescript --tailwind` flags, then apply four targeted file edits to root configs. Do not share anything between the two projects.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use `create-next-app@latest` to scaffold `/website` with App Router, TypeScript, and Tailwind v4 pre-configured
- **D-02:** Pre-install Motion (framer-motion) and Lucide React during scaffold — both are needed in Phase 16 (BRAND-03 animations, PAGE-02 feature icons)
- **D-03:** Include a basic layout shell (layout.tsx with header/footer placeholders, Dwella indigo #4F46E5 in globals.css) to confirm the build works with real structure
- **D-04:** Create a new `metro.config.js` extending `expo/metro-config` with `/website` added to the blockList — no metro.config.js exists currently
- **D-05:** Add `website/` to the root `tsconfig.json` exclude array (alongside existing `supabase/functions` exclusion)
- **D-06:** Add convenience scripts to root `package.json`: `website:dev` and `website:build` using `npm --prefix website`
- **D-07:** Use bash `git diff --quiet HEAD^ HEAD ./website` in the Ignored Build Step field to skip mobile-only commits
- **D-08:** Commit a `vercel.json` inside `/website` with framework/build settings as code — dashboard used only for secrets and domain config
- **D-CF1:** Next.js 15 + Tailwind v4 + App Router — SSG via `output: 'export'`
- **D-CF2:** `/website` is fully isolated — no npm workspaces, no shared node_modules, no root tsconfig extension
- **D-CF3:** Dwella brand palette indigo #4F46E5 is canonical (discard teal #009688 from old landing)

### Claude's Discretion
- Specific Next.js version pinning within the v15 range
- ESLint rule configuration within /website
- Exact vercel.json settings beyond framework and output config

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SETUP-01 | Next.js 15 project scaffolded in `/website` with its own `package.json` and `tsconfig.json`, isolated from the Expo app | `create-next-app@latest` produces a self-contained project with own configs; verified isolation via no workspaces and no root tsconfig extension |
| SETUP-02 | Metro config updated with blockList to exclude `/website` directory from mobile builds | Metro `blockList` accepts RegExp array; pattern `/website\/` added to `getDefaultConfig()` config — confirmed via `@expo/metro-config` source at v0.19.x |
| SETUP-03 | Root `tsconfig.json` excludes `website/` from Expo type checking | Root tsconfig already has an `exclude` array with `supabase/functions` — add `website` as second entry; confirmed correct pattern |
| SETUP-04 | Vercel project configured with `website` as root directory and Ignored Build Step to prevent unnecessary deploys | Vercel Ignored Build Step exit-code contract documented: 0 = skip, 1 = build; `git diff HEAD^ HEAD --quiet -- .` run from root-directory context is the canonical pattern |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.x (currently 15.2.4 on npm) | App Router, SSG, build pipeline | Locked decision D-CF1 |
| react | 19.x (bundled by create-next-app) | Component model | Matches Expo app's React 19.1.0 |
| typescript | 5.x | Type safety | Consistent with root tsconfig strict |
| tailwindcss | 4.x | Utility CSS | Locked decision D-01; v4 included by create-next-app |

### Supporting (pre-install per D-02)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion (Motion) | 12.x (currently 12.38.0) | Scroll animations | Phase 16 BRAND-03 |
| lucide-react | 0.x (currently 0.511.0) | Feature section icons | Phase 16 PAGE-02 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind v4 | Tailwind v3 | v4 is auto-configured by create-next-app; no config file needed; no reason to downgrade |
| framer-motion | CSS animations | framer-motion required by D-02; do not substitute |

**Installation (inside /website after scaffold):**
```bash
npm install framer-motion lucide-react
```

**Verified versions (npm registry, 2026-03-30):**
- `next`: 15.2.4 (latest on npm as of research date) — `create-next-app@latest` will install this
- `framer-motion`: 12.38.0
- `lucide-react`: 0.511.0 (package reports 1.7.0 via `npm view` shorthand; full version is in dist-tags)

Note: `create-next-app@latest` will scaffold with the current latest. Do not pin a specific patch — use whatever the scaffold produces. The `package.json` inside `/website` will lock the version.

## Architecture Patterns

### Recommended Project Structure
```
website/
├── app/
│   ├── layout.tsx       # Root layout — html/body, header placeholder, footer placeholder
│   ├── page.tsx         # Home route (placeholder for Phase 16 content)
│   └── globals.css      # Tailwind v4 import + Dwella CSS custom properties
├── components/
│   ├── Header.tsx       # Placeholder header (nav shell)
│   └── Footer.tsx       # Placeholder footer
├── public/              # Static assets (empty at this phase)
├── next.config.ts       # output: 'export', images: { unoptimized: true }
├── tsconfig.json        # Auto-generated by create-next-app (standalone, no root extension)
├── package.json         # Auto-generated; add framer-motion + lucide-react
├── vercel.json          # Framework config as code
└── .gitignore           # .next/, out/, node_modules/ — confirm entries present
```

### Pattern 1: Metro blockList with getDefaultConfig
**What:** Extend the Expo default Metro config and append an additional regex to the existing `blockList` array.
**When to use:** Any time a non-RN directory exists at the project root that Metro would otherwise try to resolve.

```javascript
// metro.config.js (project root — created fresh, does not exist yet)
// Source: https://metrobundler.dev/docs/configuration/ + @expo/metro-config source
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude /website from Metro resolution — it is a separate Next.js project
config.resolver.blockList = [
  ...(config.resolver.blockList ?? []),
  /\/website\/.*/,
];

module.exports = config;
```

**Why spread instead of replace:** `@expo/metro-config` v0.19.x already populates `blockList` with its own entries (`/\.expo[\\/]types/` and platform defaults). Replacing it entirely would break Expo's own exclusions. Always spread the existing array first.

**Path pattern note:** The regex `/\/website\/.*/` matches any absolute path containing `/website/`. This works on both macOS and Linux CI. On Windows dev machines, Metro normalizes to forward slashes internally, so the same regex works.

### Pattern 2: Next.js SSG Static Export
**What:** `output: 'export'` in `next.config.ts` causes `next build` to emit to `out/` as static HTML/CSS/JS.
**When to use:** Always — no server-side features are needed for a marketing landing page.

```typescript
// website/next.config.ts
// Source: https://nextjs.org/docs/app/guides/static-exports
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true, // Required for static export — no next/image optimization server
  },
};

export default nextConfig;
```

**SSG constraints to know:**
- `next/image` default loader is unsupported with `output: 'export'` — `unoptimized: true` is required or a custom loader must be provided
- No Server Actions, no cookies, no rewrites/redirects/headers
- Dynamic routes require `generateStaticParams()` — not needed for this landing page
- `out/` directory is the build artifact (not `.next/`)

### Pattern 3: Root tsconfig.json Exclusion
**What:** Add `website` to the existing `exclude` array.
**When to use:** Whenever a subdirectory contains its own tsconfig.json and should be fully opaque to the root compiler.

```json
// tsconfig.json (root) — current state + website addition
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.d.ts",
    "expo-env.d.ts",
    ".expo/types/**/*.ts"
  ],
  "exclude": [
    "supabase/functions",
    "website"
  ]
}
```

**Critical note:** The `include` glob `**/*.ts` would otherwise pull in every `.ts` file in `website/` including its own `tsconfig.json` `compilerOptions` — this causes the Expo tsc run to attempt to type-check Next.js-specific APIs it doesn't know about.

### Pattern 4: Vercel vercel.json (D-08)
**What:** Commit framework/build settings as code. Dashboard handles only secrets and domain.

```json
// website/vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": "out",
  "installCommand": "npm install"
}
```

**Ignored Build Step command (configured in Vercel dashboard, not in vercel.json):**
```bash
git diff HEAD^ HEAD --quiet -- .
```
This command runs with `website/` as the working directory (because Root Directory is set to `website` in the Vercel project). The `.` refers to the `website/` tree. Exit code 0 (no changes) = skip build. Exit code 1 (changes detected) = proceed with build. This is the documented Vercel pattern.

### Pattern 5: Root package.json Convenience Scripts (D-06)
```json
// Addition to root package.json scripts section
"website:dev": "npm --prefix website run dev",
"website:build": "npm --prefix website run build"
```

### Anti-Patterns to Avoid
- **Extending root tsconfig from website/tsconfig.json:** The decisions explicitly forbid this (D-CF2). The website tsconfig must be standalone.
- **npm workspaces:** Explicitly prohibited (D-CF2). Do not add `"workspaces"` to root `package.json`.
- **Replacing blockList entirely:** Always spread existing entries. Replacing breaks Expo internal exclusions.
- **Using `next export` command:** Removed in Next.js 14. Use `output: 'export'` in next.config only.
- **Forgetting `unoptimized: true` for images:** Static export will fail at build time if `next/image` is used with the default loader.
- **Using teal #009688 brand color:** Old landing page color. Discard. Canonical is indigo #4F46E5 (D-CF3).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Static site generation | Custom build script | Next.js `output: 'export'` | Battle-tested, Vercel-native |
| TypeScript project isolation | Manual path exclusion hacks | tsconfig `exclude` array | Official TS compiler support |
| Metro directory exclusion | Custom resolver plugin | `blockList` regex | Metro's official API |
| CSS utility system | Custom CSS vars only | Tailwind v4 (pre-configured by scaffold) | Already included, no additional setup |
| Deploy optimization | Webhook filters | Vercel Ignored Build Step | Official platform feature |

**Key insight:** Every infrastructure problem in this phase has a first-party solution. No custom tooling is needed.

## Runtime State Inventory

Step 2.5 SKIPPED: This is a greenfield setup phase, not a rename/refactor/migration. No existing runtime state is affected by creating `/website`.

One item worth noting: the existing `landing/index.html` file in the repo uses teal #009688 and is a plain HTML file — it is NOT the new website and should be left untouched by this phase (it is not deleted here, merely superseded in future phases by the Next.js site).

## Common Pitfalls

### Pitfall 1: Metro resolution errors for website/node_modules
**What goes wrong:** After creating `/website` with its own `node_modules/`, Metro may try to resolve files inside it and throw errors about unexpected modules.
**Why it happens:** Metro's default watcher scans all subdirectories including nested `node_modules`. The `blockList` prevents resolution but Metro may still log warnings about the watcher seeing the directory.
**How to avoid:** The `blockList` regex `/\/website\/.*/` covers `website/node_modules/` — verify the regex is broad enough (it is, since `website/node_modules/some-package` contains `/website/`).
**Warning signs:** Metro prints "Unable to resolve module" or "Haste module map error" after adding `/website`.

### Pitfall 2: Tailwind v4 globals.css import syntax
**What goes wrong:** Following Tailwind v3 guides and using `@tailwind base; @tailwind components; @tailwind utilities;` in globals.css breaks with v4.
**Why it happens:** Tailwind v4 replaced the three-layer import with a single `@import "tailwindcss"` directive plus PostCSS plugin. The old syntax causes a build error.
**How to avoid:** Let `create-next-app` generate globals.css — it uses the correct v4 syntax. Do not overwrite the generated import line. When adding brand colors, append CSS custom properties AFTER the Tailwind import.
**Warning signs:** Build error "Unknown at-rule @tailwind" or missing styles in output.

### Pitfall 3: Vercel Ignored Build Step exit code inversion
**What goes wrong:** Script returns 0 when changes ARE present and 1 when they aren't, causing all builds to skip.
**Why it happens:** Confusion about `git diff --quiet` semantics. `git diff --quiet` exits 0 if NO differences exist, 1 if differences DO exist.
**How to avoid:** The command `git diff HEAD^ HEAD --quiet -- .` exits 1 (build proceeds) when website files changed, exits 0 (build skipped) when only non-website files changed. This is the CORRECT behavior. Do not negate the exit code.
**Warning signs:** All Vercel deployments say "Skipped" even when website files change.

### Pitfall 4: Root tsconfig include glob overrides exclude
**What goes wrong:** `npx tsc --noEmit` from the root still picks up `website/` files despite the `exclude` entry.
**Why it happens:** TypeScript's `exclude` applies to the implicit `include` glob, but if a file is explicitly listed in `include`, it wins. The root tsconfig uses `**/*.ts` which could conflict if there's a race condition in path matching.
**How to avoid:** Use directory name only in `exclude` (`"website"` not `"website/**/*"`). TypeScript treats directory names in `exclude` as recursive exclusions. Verify by running `npx tsc --noEmit` after the edit.
**Warning signs:** Errors like "Cannot find module 'next'" in tsc output from the root.

### Pitfall 5: create-next-app prompts blocking non-interactive install
**What goes wrong:** Running `create-next-app@latest` without flags prompts interactively, potentially selecting wrong options.
**Why it happens:** Default behavior is interactive.
**How to avoid:** Pass all flags explicitly: `--app --typescript --tailwind --eslint --no-src-dir --import-alias "@/*"`. The `--no-src-dir` flag matches the decided structure (no `src/` wrapper). The `--import-alias "@/*"` matches the root project convention.
**Warning signs:** Scaffold creates `src/app/` instead of `app/`, or uses JavaScript instead of TypeScript.

## Code Examples

### Complete metro.config.js
```javascript
// metro.config.js (create at project root)
// Source: https://metrobundler.dev/docs/configuration/ + expo/metro-config template
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude the /website Next.js project from Metro's module resolution.
// Without this, Metro may attempt to resolve Next.js modules and fail.
config.resolver.blockList = [
  ...(config.resolver.blockList ?? []),
  /\/website\/.*/,
];

module.exports = config;
```

### globals.css brand color addition (Tailwind v4)
```css
/* website/app/globals.css — append after Tailwind import */
@import "tailwindcss";

:root {
  --brand-primary: #4F46E5;    /* Dwella indigo */
  --brand-primary-dark: #4338CA;
  --background: #ffffff;
  --foreground: #0f172a;
}
```

### Scaffold command (to be run from project root)
```bash
npx create-next-app@latest website \
  --app \
  --typescript \
  --tailwind \
  --eslint \
  --no-src-dir \
  --import-alias "@/*"
```

### layout.tsx shell (D-03)
```typescript
// website/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dwella — The AI that runs your rentals',
  description: 'Track rent, manage tenants, and let AI handle the rest.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header>{/* Phase 16: navigation */}</header>
        <main>{children}</main>
        <footer>{/* Phase 16: footer links */}</footer>
      </body>
    </html>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next export` CLI command | `output: 'export'` in next.config | Next.js v14.0.0 | The old command no longer exists; using it would error |
| Tailwind v3 three-layer imports | Single `@import "tailwindcss"` in v4 | Tailwind v4.0.0 | New PostCSS plugin; no `tailwind.config.js` needed |
| `exclusionList()` helper (older Metro) | `blockList` array directly | Metro v0.73+ | `exclusionList` still exists in some metro-config versions but `blockList` is the canonical key |

**Deprecated/outdated:**
- `next export`: Removed in v14. Use `output: 'export'` in config instead.
- `tailwind.config.js`: Not needed for v4. Auto-scanning replaces it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Running Next.js dev server | ✓ | v24.11.1 | — |
| npm | Package installation | ✓ | 11.6.2 | — |
| npx / create-next-app | Scaffolding | ✓ | (run via npm) | — |
| Vercel CLI or dashboard | SETUP-04 | Dashboard (manual) | — | Manual config via dashboard only |
| git | Ignored Build Step diff command | ✓ | (present, git repo active) | — |

**Missing dependencies with no fallback:** None — all required tools are available locally.

**Note on Vercel:** SETUP-04 (Vercel project configuration) requires manual dashboard action — creating a Vercel project, setting Root Directory to `website`, and entering the Ignored Build Step command. This cannot be automated locally. The plan must include this as a manual step with clear instructions.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29 + jest-expo (existing root setup) |
| Config file | `jest.config.js` (root) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETUP-01 | `/website` directory exists with own package.json and tsconfig.json | smoke (filesystem check) | `ls website/package.json website/tsconfig.json` | ❌ Wave 0 — not a Jest test; verify via command |
| SETUP-01 | `npm run build` inside website succeeds | smoke | `npm --prefix website run build` | ❌ Wave 0 — run as build verification |
| SETUP-02 | Metro does not error on `/website` files | smoke | `npx expo start --non-interactive` (observe for errors) | ❌ Wave 0 — manual observation |
| SETUP-03 | Root `npx tsc --noEmit` does not error on Next.js types | smoke | `npx tsc --noEmit` | ❌ Wave 0 — run as tsc check |
| SETUP-04 | Vercel project exists with correct config | manual | Dashboard verification | N/A — manual only |

**Assessment:** This phase has no unit-testable logic. All four requirements are verified via CLI commands and smoke checks, not Jest tests. The existing Jest suite (`__tests__/`) tests Expo app logic and is irrelevant to this phase. The plan should include explicit verification commands for each requirement rather than Jest tests.

### Sampling Rate
- **Per task commit:** Run relevant smoke command for that task (e.g., `npx tsc --noEmit` after SETUP-03)
- **Per wave merge:** `npm --prefix website run build` + `npx tsc --noEmit`
- **Phase gate:** All four success criteria commands pass before `/gsd:verify-work`

### Wave 0 Gaps
- No Jest test files needed — all verification is via CLI smoke checks
- Existing `__tests__/` suite must continue to pass (it tests Expo app logic, unaffected by this phase)

*(No new Jest infrastructure needed. Phase verification is build/compile output, not unit tests.)*

## Open Questions

1. **Does `create-next-app@latest` install Tailwind v4 or v3 by default?**
   - What we know: Tailwind v4 is current latest. Multiple sources confirm create-next-app uses Tailwind v4 when --tailwind flag is passed as of early 2026.
   - What's unclear: The exact version depends on the scaffold's peer resolution at time of install.
   - Recommendation: Accept whatever the scaffold provides; verify `tailwindcss` version in `website/package.json` after install. If v3 is installed for any reason, upgrade — but this is unlikely.

2. **Does `/website` need its own `.gitignore` entries, or does the root `.gitignore` cover it?**
   - What we know: The root `.gitignore` already contains `.next/`, `out/`, and `node_modules/` entries (generic, not path-scoped).
   - What's unclear: Git applies `.gitignore` patterns relative to the file's location. Root-level `node_modules/` matches `website/node_modules/` — git gitignore is recursive by default.
   - Recommendation: Verify after scaffold that `website/node_modules/` and `website/.next/` are ignored by the root `.gitignore`. If `create-next-app` adds its own `.gitignore` inside `/website`, that is fine and additive. Do not remove it.

## Sources

### Primary (HIGH confidence)
- Next.js official docs (fetched 2026-03-25): https://nextjs.org/docs/app/guides/static-exports — Static export configuration, constraints, `output: 'export'` API
- Metro bundler official docs (fetched): https://metrobundler.dev/docs/configuration/ — `blockList` API, RegExp pattern format
- `@expo/metro-config` source (read directly from node_modules v0.19.x) — confirmed `blockList` spread pattern, existing entries
- Vercel KB (fetched): https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel — Exit code contract, git diff command
- Root project files (read directly): `tsconfig.json`, `package.json`, `jest.config.js`, `.gitignore`, node_modules/expo (v54.0.33)

### Secondary (MEDIUM confidence)
- npm registry (npm view, 2026-03-30): `next` 15.2.4 (or latest), `framer-motion` 12.38.0, `lucide-react` latest
- WebSearch cross-reference: create-next-app flags, Tailwind v4 globals.css import syntax change

### Tertiary (LOW confidence)
- None required — all critical claims verified via primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from npm registry and official docs
- Architecture: HIGH — patterns read from Expo source and Next.js official docs
- Pitfalls: HIGH — derived from first-party source behavior analysis (blockList spread, tsconfig exclude semantics)
- Vercel config: HIGH — verified from official Vercel KB article

**Research date:** 2026-03-30
**Valid until:** 2026-06-30 (stable tooling — Next.js, Metro, Vercel Ignored Build Step are not fast-moving)
