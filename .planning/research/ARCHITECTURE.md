# Architecture Research

**Domain:** Next.js landing page integrated into Expo/React Native monorepo
**Researched:** 2026-03-30
**Confidence:** HIGH

---

## Context: What Already Exists

The repo already has a `landing/index.html` — a fully-written static HTML/CSS file with hero, features, store download links, and basic SEO. This is the content baseline for the Next.js migration. The existing file uses:

- Brand color `#009688` (teal) — **note: PROJECT.md specifies indigo `#4F46E5` as primary brand**
- Inline CSS, vanilla JS scroll animations
- Live App Store link (`id6760478576`) and Play Store link

The Next.js site replaces this file. The `/landing` directory can be deleted once `/website` is in place.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Git Repository Root                         │
├───────────────────────────┬─────────────────────────────────────┤
│   Mobile App (Expo)       │   Landing Page (Next.js)            │
│   ─────────────────────   │   ─────────────────────────────     │
│   /app       (screens)    │   /website/app/   (Next.js App)     │
│   /components             │   /website/public/(static assets)   │
│   /hooks                  │   /website/package.json (isolated)  │
│   /lib                    │   /website/tsconfig.json (isolated) │
│   /constants              │   /website/next.config.ts           │
│   /supabase               │   /website/vercel.json              │
│   package.json (Expo)     │                                     │
│   tsconfig.json (Expo)    │                                     │
│   metro.config.js         │                                     │
├───────────────────────────┴─────────────────────────────────────┤
│                   Shared (read-only from /website)               │
│   /assets/icon.png, /assets/favicon.png, /assets/images/        │
└─────────────────────────────────────────────────────────────────┘

Build pipelines are COMPLETELY SEPARATE:
  Expo mobile  →  EAS Build  →  App Store / Play Store
  Next.js site →  Vercel     →  dwella.app (or subdomain)
```

---

## Recommended Project Structure

```
website/                        # Next.js project root — ISOLATED from Expo
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout (metadata, fonts, global CSS)
│   ├── page.tsx                # Home page (hero + features + CTA)
│   ├── privacy/
│   │   └── page.tsx            # Privacy policy (required for app stores)
│   └── contact/
│       └── page.tsx            # Contact / support section
├── components/                 # Web-only React components
│   ├── HeroSection.tsx
│   ├── FeatureGrid.tsx
│   ├── AppStoreBadges.tsx
│   ├── Footer.tsx
│   └── NavBar.tsx
├── lib/                        # Web-only utilities (analytics, etc.)
├── public/                     # Static assets served at /
│   ├── favicon.png             # Copied from ../assets/favicon.png at build
│   ├── icon.png                # Copied from ../assets/icon.png
│   └── screenshots/            # App screenshots for feature section
├── styles/
│   └── globals.css             # Tailwind base + brand tokens
├── next.config.ts              # Next.js config (output: 'export' for SSG)
├── package.json                # ISOLATED: next, react, react-dom only
├── tsconfig.json               # ISOLATED: extends nothing from repo root
├── tailwind.config.ts          # Tailwind with Dwella brand colors
├── postcss.config.mjs
└── vercel.json                 # Vercel deployment config for subdirectory
```

### Structure Rationale

- **`website/` at repo root:** Keeps the two build systems physically adjacent without nesting either inside the other. The `/website` name (over `/landing`) is conventional and matches the v1.3 requirements spec.
- **Separate `package.json`:** Next.js and Expo have incompatible peer dependencies (both pull in React, but with different version expectations). Isolation in `website/` means `npm install` inside that directory installs Next.js dependencies without touching the Expo `node_modules`. The root `package.json` does NOT need workspace configuration for this use case.
- **Separate `tsconfig.json`:** The root `tsconfig.json` extends `expo/tsconfig.base` and includes all `**/*.ts` files — pulling in Next.js files would cause `react-dom` types to conflict with `react-native` types. The `website/tsconfig.json` must NOT extend the root.
- **`public/` for assets:** Next.js serves everything in `public/` at the root URL. Copy shared assets here — do not reference `../assets/` with relative paths in Next.js (the build output won't include them).
- **`output: 'export'` in next.config.ts:** Enables fully static export (no server runtime required). Vercel can serve static exports natively. This is the right choice for a marketing landing page with no dynamic routes.

---

## Architectural Patterns

### Pattern 1: Complete Build Pipeline Isolation

**What:** The `/website` directory is a self-contained Next.js project with its own `node_modules`, `package.json`, and TypeScript config. No shared configs, no workspace hoisting.

**When to use:** Always, for this repo. Workspace setups (Turborepo, npm workspaces) are designed for sharing code between packages. There is no code to share here — the landing page and mobile app have zero shared React components because React Native components do not run on web without a compatibility layer.

**Trade-offs:** Duplication of a few constants (brand colors) — acceptable. The alternative (workspace setup) adds complexity for no practical benefit.

**Implementation:**
```json
// website/package.json — completely standalone
{
  "name": "dwella-website",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0"
  }
}
```

### Pattern 2: Metro Blockklist for /website Directory

**What:** Add a `metro.config.js` at the Expo project root with a `blockList` regex that excludes the `/website` directory from Metro's file resolution graph.

**When to use:** Needed because Metro (Expo's bundler) performs a full recursive scan of `projectRoot` by default. If `/website` contains Next.js files with `import` of `next/image` or `react-dom`, Metro will attempt to resolve them and error out.

**Trade-offs:** Adds one config file to the Expo project. Low cost.

**Implementation:**
```javascript
// metro.config.js (at repo root, new file)
const { getDefaultConfig } = require('expo/metro-config');
const { exclusionList } = require('metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = exclusionList([
  // Exclude the Next.js website directory from Metro's graph
  new RegExp(`^${path.resolve(__dirname, 'website').replace(/\\/g, '/')}(/.*)?$`),
  // Exclude the old static landing page
  new RegExp(`^${path.resolve(__dirname, 'landing').replace(/\\/g, '/')}(/.*)?$`),
]);

module.exports = config;
```

**Confidence:** HIGH — Metro's `blockList` with `exclusionList` is the documented, established pattern for excluding directories (used widely in React Native Windows, Nx monorepos, and multi-app repos). The `exclusionList` helper from `metro-config` merges the custom patterns with Metro's built-in defaults so default exclusions are preserved.

### Pattern 3: Static Site Generation (SSG) with `output: 'export'`

**What:** Configure Next.js to produce a fully static output at build time — no Node.js server runtime, no server components making DB calls, no API routes.

**When to use:** Marketing landing pages with no user-specific data. The Dwella landing page shows the same content to all visitors.

**Trade-offs:** Cannot use `getServerSideProps` or API routes. Contact form must use a third-party service (Formspree, Resend, etc.) or a Supabase Edge Function URL called client-side.

**Implementation:**
```typescript
// website/next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',     // Fully static — no server needed
  trailingSlash: true,  // Generates /privacy/index.html (cleaner URL handling)
  images: {
    unoptimized: true,  // Required with output: 'export' (no Next.js image server)
  },
};

export default config;
```

### Pattern 4: Vercel Root Directory Configuration

**What:** Create a separate Vercel project pointed at the `/website` subdirectory. Vercel's "Root Directory" setting scopes the build to that directory.

**When to use:** Any monorepo with a Next.js app that is not at the repo root.

**Trade-offs:** Requires creating a Vercel project via the dashboard (one-time setup, not codeable). Vercel automatically skips rebuilds when only non-`/website` files change (smart change detection with npm workspace declaration OR via manual Ignored Build Step).

**Vercel project configuration (set in Vercel dashboard):**
```
Framework Preset:  Next.js
Root Directory:    website
Build Command:     (leave default — next build)
Output Directory:  (leave default — Next.js handles this)
Install Command:   npm install
```

**Optional `vercel.json` inside `/website` for headers and redirects:**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

---

## Data Flow

### Build-Time (SSG)

```
next build (run inside /website)
    ↓
Next.js reads app/page.tsx, app/privacy/page.tsx, app/contact/page.tsx
    ↓
Renders all pages to static HTML + JS bundles
    ↓
Output: website/out/ directory (static files)
    ↓
Vercel serves out/ as CDN-backed static hosting
```

No runtime data fetching. All content is hardcoded in JSX or loaded from local files (e.g., privacy policy markdown).

### Runtime (Visitor)

```
Browser requests dwella.app
    ↓
Vercel CDN serves static HTML (Edge Network — fastest possible)
    ↓
Browser hydrates React (client-side JS)
    ↓
PostHog web analytics (if configured — separate project key from mobile)
```

### Asset Sharing Pattern

```
Mobile app uses:
  /assets/icon.png
  /assets/favicon.png
  /assets/images/logo.png

Landing page needs the same assets. Two options:
  Option A (recommended): Copy assets into /website/public/ at init time.
                          Check them into git. No build-time copy step needed.
  Option B: Reference ../assets/ in a prebuild script.
            More fragile, adds complexity for no benefit.
```

Option A is recommended. Assets in `website/public/` are checked into git. When the mobile icon changes, manually copy to `website/public/` and commit — this happens rarely enough to not warrant automation.

---

## Component Boundaries

| Component | Responsibility | Technology | Notes |
|-----------|---------------|------------|-------|
| `/website` | Marketing site, SEO, download funneling | Next.js 15, Tailwind | Isolated build |
| `/app` (Expo) | Mobile app screens | React Native, Expo Router | Unchanged by this milestone |
| `/supabase/functions` | Backend logic | Deno Edge Functions | No changes needed for landing page |
| Vercel | Static hosting, CDN, SSL | Vercel Hobby/Pro | Separate project from EAS |
| EAS | Mobile app builds | Expo Application Services | Unchanged |

---

## Integration Points

### New vs. Modified

| File / Directory | Status | Change Description |
|-----------------|--------|--------------------|
| `website/` | NEW | Entire Next.js project |
| `metro.config.js` | NEW | Exclude `/website` and `/landing` from Metro |
| `landing/` | DELETE | Replaced by `/website` |
| `tsconfig.json` (root) | MODIFY | Add `"exclude": ["website"]` to prevent root tsc from scanning Next.js files |
| `.gitignore` | MODIFY | Add `website/.next/`, `website/out/`, `website/node_modules/` |
| Root `package.json` | NO CHANGE | Do not add workspace config — full isolation is simpler |

### Root `tsconfig.json` Modification

Add `website` to the root TypeScript excludes so `npx tsc --noEmit` (run at repo root for the mobile app) does not attempt to type-check Next.js files:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.d.ts", "expo-env.d.ts"],
  "exclude": ["supabase/functions", "website"]
}
```

### `.gitignore` Additions

```
# Next.js website
website/.next/
website/out/
website/node_modules/
```

---

## Scaling Considerations

| Scale | Architecture |
|-------|-------------|
| Launch (0-10K visitors/mo) | Static export on Vercel Hobby (free). CDN handles all traffic. No infra changes needed. |
| Growth (10K-1M visitors/mo) | Still static — Vercel CDN scales automatically. No code changes. Consider Vercel Pro for analytics. |
| Dynamic features needed | Add specific API routes (contact form handler). Keep the rest static. Do not abandon SSG for the whole site. |

The landing page will never be the bottleneck. Vercel's CDN handles millions of static requests on the free plan.

---

## Anti-Patterns

### Anti-Pattern 1: Workspace/Monorepo Hoisting

**What people do:** Add `"workspaces": ["website"]` to the root `package.json` to share devDependencies.

**Why it's wrong:** Causes npm/yarn to hoist Next.js deps alongside Expo deps. React and react-dom get hoisted to root `node_modules`, conflicting with `react-native`. Expo's Metro then picks up `react-dom` and errors. This is a well-documented pain point in shared-React-version monorepos.

**Do this instead:** Keep `/website` completely isolated. Run `npm install` from inside `website/`. Accept that `react` and `typescript` are listed in both `package.json` files.

### Anti-Pattern 2: Importing Mobile Components in the Website

**What people do:** Try to reuse `components/TourGuideCard.tsx` or `constants/colors.ts` in the Next.js site via relative imports (`../constants/colors`).

**Why it's wrong:** Those files import `react-native`, which is not available in a Next.js build. Even if colors.ts looks safe, the moment you extend the import tree you hit native modules. The Metro blockList becomes irrelevant because the Next.js compiler (webpack/turbopack) will also error.

**Do this instead:** Duplicate the brand colors into `website/tailwind.config.ts`. It is 4 lines of hex codes. The duplication cost is trivial compared to the compatibility cost.

```typescript
// website/tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',      // Indigo — Dwella brand
        'primary-dark': '#3730A3',
        accent: '#F59E0B',
        text: '#0F172A',
        surface: '#FFFFFF',
        bg: '#F5F5F7',
      },
    },
  },
};
```

### Anti-Pattern 3: Using the Static `landing/index.html` as a Next.js Page

**What people do:** Copy `landing/index.html` into `website/app/page.tsx` as a large JSX blob and call it done.

**Why it's wrong:** The existing HTML uses `var` declarations, a non-`strict` style, inline `<style>` tags, and vanilla JS. Pasting it into a TypeScript React component creates a large refactor debt and defeats the purpose of using Next.js (structured components, Tailwind, SEO metadata API, image optimization).

**Do this instead:** Treat the existing HTML as a *content reference* only. Re-implement it as proper Next.js components (`HeroSection`, `FeatureGrid`, `AppStoreBadges`, etc.). The content (copy, links, section structure) is preserved — the implementation is rebuilt cleanly.

### Anti-Pattern 4: Putting `next.config.ts` at the Repo Root

**What people do:** Add Next.js configuration to the project root, assuming Vercel will find it.

**Why it's wrong:** `next.config.ts` at the root is not inside `/website`, so Vercel (configured with Root Directory = `website`) never sees it. The Expo project root has no business containing Next.js config.

**Do this instead:** All Next.js config lives inside `/website`. Vercel's root directory setting handles the rest.

---

## Build Order

Ordered by dependency: each step only requires what the previous step established.

1. **Scaffold `/website` directory** — run `npx create-next-app@latest website --typescript --tailwind --app --no-src-dir --no-import-alias` from repo root. This installs Next.js, creates the App Router structure, and generates `tsconfig.json` and `next.config.ts`. (New file, 0 dependencies on prior steps.)

2. **Update root `tsconfig.json` and `metro.config.js`** — add `"website"` to the root tsconfig `exclude` array, create `metro.config.js` with the blockList. (Modifies 1 existing file, creates 1 new file. Must happen before running Expo dev server with the website directory present to avoid Metro errors.)

3. **Update `.gitignore`** — add website build artifacts. (1-line addition. Low risk, do early.)

4. **Copy shared assets** — copy `assets/favicon.png`, `assets/icon.png`, `assets/images/logo.png` into `website/public/`. (No code change, file copy only.)

5. **Configure `next.config.ts`** — set `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true`. (Inside `/website`, no dependency on Expo.)

6. **Configure Tailwind** — add Dwella brand colors to `website/tailwind.config.ts`. (Inside `/website`, no external dependency.)

7. **Build page components** — implement `HeroSection`, `FeatureGrid`, `AppStoreBadges`, `Footer`, `NavBar`. Wire up in `app/page.tsx`. (Depends on steps 5-6.)

8. **Add `/privacy` and `/contact` routes** — create `app/privacy/page.tsx` and `app/contact/page.tsx`. (Depends on step 7 for layout/component reuse.)

9. **Verify local build** — run `cd website && npm run build` and confirm `out/` directory is generated with no errors. (Smoke test before touching Vercel.)

10. **Create Vercel project** — import GitHub repo in Vercel dashboard, set Root Directory to `website`, deploy. (Depends on step 9 passing.)

11. **Delete `/landing`** — remove the old static HTML directory. (Final cleanup, after Vercel deploy is confirmed live.)

---

## Sources

- Vercel monorepo documentation (Root Directory setting, skip unaffected projects): [Using Monorepos — Vercel Docs](https://vercel.com/docs/monorepos) — HIGH confidence
- Metro `blockList` / `exclusionList` configuration: [Configuring Metro — Metro Docs](https://metrobundler.dev/docs/configuration/) — HIGH confidence
- Expo SDK 52+ automatic Metro monorepo detection: [Work with monorepos — Expo Docs](https://docs.expo.dev/guides/monorepos/) — HIGH confidence
- Next.js 15 App Router project structure: [Next.js Documentation](https://nextjs.org/docs) — HIGH confidence
- `output: 'export'` static export for Next.js: Next.js official docs — HIGH confidence
- Monorepo React Native + Next.js coexistence pitfalls (hoisting conflicts): [Monorepos with Next.js and React Native — tyhopp.com](https://tyhopp.com/notes/monorepos-next-js-react-native) — MEDIUM confidence (single source, aligns with known Expo behavior)

---
*Architecture research for: Dwella v1.3 — Next.js Landing Page integration in Expo monorepo*
*Researched: 2026-03-30*
