# Phase 15: Project Setup & Infrastructure - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Create an isolated Next.js 15 project in `/website` that builds independently and does not interfere with the Expo mobile app's build pipeline. This phase delivers infrastructure only — no content pages, no branding, no SEO.

</domain>

<decisions>
## Implementation Decisions

### Scaffold Approach
- **D-01:** Use `create-next-app@latest` to scaffold `/website` with App Router, TypeScript, and Tailwind v4 pre-configured
- **D-02:** Pre-install Motion (framer-motion) and Lucide React during scaffold — both are needed in Phase 16 (BRAND-03 animations, PAGE-02 feature icons)
- **D-03:** Include a basic layout shell (layout.tsx with header/footer placeholders, Dwella indigo #4F46E5 in globals.css) to confirm the build works with real structure

### Build Isolation
- **D-04:** Create a new `metro.config.js` extending `expo/metro-config` with `/website` added to the blockList — no metro.config.js exists currently
- **D-05:** Add `website/` to the root `tsconfig.json` exclude array (alongside existing `supabase/functions` exclusion)
- **D-06:** Add convenience scripts to root `package.json`: `website:dev` and `website:build` using `npm --prefix website`

### Vercel Deploy Configuration
- **D-07:** Use bash `git diff --quiet HEAD^ HEAD ./website` in the Ignored Build Step field to skip mobile-only commits
- **D-08:** Commit a `vercel.json` inside `/website` with framework/build settings as code — dashboard used only for secrets and domain config

### Dev Workflow
- **D-09:** Website tooling is fully independent — own ESLint/Prettier config (or Next.js defaults), no shared config with the Expo app. Matches the "no shared anything" isolation principle
- **D-10:** Use Next.js default port 3000 for dev server — no conflict with Expo's port 8081

### Carried Forward (from milestone planning)
- **D-CF1:** Next.js 15 + Tailwind v4 + App Router — SSG via `output: 'export'`
- **D-CF2:** `/website` is fully isolated — no npm workspaces, no shared node_modules, no root tsconfig extension
- **D-CF3:** Dwella brand palette indigo #4F46E5 is canonical (discard teal #009688 from old landing)

### Claude's Discretion
- Specific Next.js version pinning within the v15 range
- ESLint rule configuration within /website
- Exact vercel.json settings beyond framework and output config

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Configuration
- `tsconfig.json` — Root TypeScript config that needs `website/` exclusion added
- `app.json` — Expo app config (reference for scheme, bundle ID — do not modify)
- `package.json` — Root package.json where convenience scripts will be added

### Existing Codebase Context
- `.planning/codebase/STACK.md` — Current tech stack (Expo SDK 51+, TypeScript 5.3, React 19.1)
- `.planning/codebase/CONVENTIONS.md` — Naming and file organization patterns

### Requirements
- `.planning/REQUIREMENTS.md` §Setup & Infrastructure — SETUP-01 through SETUP-04 acceptance criteria
- `.planning/ROADMAP.md` §Phase 15 — Success criteria for build isolation verification

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None directly reusable — `/website` is a separate Next.js project with its own dependency tree

### Established Patterns
- Root `tsconfig.json` already has an exclude pattern (`supabase/functions`) — follow the same approach for `website/`
- No `metro.config.js` exists — this phase creates one from scratch
- Root `package.json` has standard Expo scripts — convention for adding prefixed scripts (`website:dev`, `website:build`)

### Integration Points
- Metro bundler: new `metro.config.js` must extend `expo/metro-config` correctly
- Root TypeScript: `tsconfig.json` exclude array
- Root npm scripts: `package.json` scripts section
- Git: `.gitignore` may need entries for `website/.next/` and `website/node_modules/`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard Next.js 15 scaffold with SSG export configuration.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-project-setup-infrastructure*
*Context gathered: 2026-03-30*
