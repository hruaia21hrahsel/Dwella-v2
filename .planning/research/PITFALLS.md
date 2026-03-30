# Pitfalls Research

**Domain:** Next.js Marketing Landing Page added to React Native + Expo monorepo — v1.3 Dwella Landing Page
**Researched:** 2026-03-30
**Confidence:** HIGH (cross-verified with Vercel official docs, Expo official docs, Next.js official docs, and multiple community post-mortems)

---

## Critical Pitfalls

### Pitfall 1: Vercel Deploys Every Commit — Including Mobile-Only Changes

**What goes wrong:**
Without explicit "Ignored Build Step" configuration, Vercel rebuilds the website every time any file in the monorepo changes — even commits that only touch the React Native app (`app/`, `components/`, `supabase/`). This burns through the free tier's 100 deployments/day limit and creates noise in the deployment history, making it harder to spot real website regressions.

**Why it happens:**
Vercel's default behavior is to trigger a new deployment on every git push to the branch, regardless of which files changed. Developers who set the Root Directory to `website/` assume Vercel will ignore non-website changes — it does not.

**How to avoid:**
Set the "Ignored Build Step" in Vercel project settings to only build when `website/` files change:

```bash
git diff HEAD^ HEAD --quiet -- website/
```

If the exit code is 0 (no changes in `website/`), Vercel skips the build. Verify this via the Vercel dashboard build logs — look for "Skipped Build" entries.

**Warning signs:**
- Vercel shows a new deployment after a Supabase migration commit.
- Build history is dominated by skipped or redundant deployments.
- Getting close to the 100/day free tier limit without shipping any website changes.

**Phase to address:**
Phase 1 (Project Setup). Configure "Ignored Build Step" before the first real deployment. Do not defer this — it cannot be retroactively fixed cleanly.

---

### Pitfall 2: Root `package.json` and `tsconfig.json` Conflicts Between Expo and Next.js

**What goes wrong:**
Expo's Metro bundler and Next.js's Webpack both read `tsconfig.json` for path aliases and module resolution. If a root-level `tsconfig.json` exists (likely, since the Expo project is at the repo root), Next.js will inherit it — causing it to try to resolve React Native-specific paths (`@/components` pointing to native components, `react-native` imports, native-only types). This breaks the Next.js build with module-not-found errors or produces incorrect type resolution.

The inverse also happens: if Expo's Metro picks up `website/tsconfig.json`, it may find conflicting `lib` targets or module formats.

**Why it happens:**
Developers place the Next.js app in `website/` but forget that TypeScript project references must explicitly scope each subproject. Both tools silently extend parent configs through `tsconfig.json` `extends` chains.

**How to avoid:**
- Give `website/` its own self-contained `tsconfig.json` with `"extends": "next/typescript/tsconfig.json"` and explicit `include` limited to `["website/**/*"]`.
- Do NOT use `"extends": "../../tsconfig.json"` — this pulls in Expo's config.
- Confirm the root `tsconfig.json` (Expo's) has `"exclude": ["website"]` to prevent Metro from scanning the website directory.
- Test by running `npx tsc --noEmit` from inside `website/` and from the repo root separately.

**Warning signs:**
- `Module not found: Can't resolve 'react-native'` errors during `next build`.
- TypeScript errors in `website/` that reference React Native types.
- Metro complains about parsing JSX or ESM in `website/node_modules`.

**Phase to address:**
Phase 1 (Project Setup). Set up the tsconfig isolation before writing a single component. Fixing this after pages are built is a painful find-and-replace exercise.

---

### Pitfall 3: React Version Mismatch Between Expo and Next.js Causes Silent Runtime Errors

**What goes wrong:**
Expo SDK 51 pins React to a specific version (currently 18.2.0). Next.js 14+ supports React 18 and 19. If the workspace hoisting resolves two different React versions — one for the Expo app, one for `website/` — you get "Invalid hook call" errors, hydration mismatches, or subtle rendering bugs that only appear in production builds.

**Why it happens:**
npm/yarn workspaces hoist shared packages to the root `node_modules`. If `website/package.json` specifies `"react": "^19.0.0"` and the root locks React at 18.2.0, the workspace resolver may pull in two copies, one for each package. React does not support multiple instances in one process.

**How to avoid:**
- `website/` is NOT a workspace package — keep it as a standalone directory with its own `node_modules`, not registered in any root `workspaces` field.
- If you ever add a root-level `workspaces` config, explicitly exclude `website` or pin React to the same version across all packages.
- Check `website/node_modules/react` exists as its own copy, not a symlink to the root.
- `website/package.json` should mirror the Expo project's React version: `"react": "18.2.0"` (exact, not `^`).

**Warning signs:**
- "Warning: Invalid hook call" in the browser console on the website.
- `next build` succeeds but hydration errors appear in production.
- `npm ls react` from `website/` shows multiple versions.

**Phase to address:**
Phase 1 (Project Setup). Version pinning must be established before installing any additional dependencies in `website/`.

---

### Pitfall 4: `metadataBase` Not Set — All OG/Twitter Images Point to `localhost`

**What goes wrong:**
Next.js App Router resolves relative URLs for Open Graph and Twitter Card images using `metadataBase`. If `metadataBase` is not set in `layout.tsx`, all image URLs in share previews resolve to `http://localhost:3000/og.png` — which works locally but is completely broken when the page is shared on Twitter, LinkedIn, or iMessage. LinkedIn and Twitter show blank cards. The bug is invisible in development.

**Why it happens:**
The `metadataBase` requirement is a Next.js App Router-specific behavior, not inherited from Pages Router. Developers moving from tutorials or Pages Router examples miss it entirely. The bug is only detectable by testing with a social debugger tool against the actual production URL.

**How to avoid:**
Set `metadataBase` in `app/layout.tsx` using an environment variable with a fallback:

```typescript
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dwella.app'
  ),
  // ...
}
```

Verify using the Twitter Card Validator (https://cards-dev.twitter.com/validator) and Facebook Debugger (https://developers.facebook.com/tools/debug/) against the production URL before considering SEO complete.

**Warning signs:**
- OG image preview is blank when pasting the URL into Slack or iMessage.
- Next.js logs a warning: `metadata.metadataBase is not set`.
- Social media debuggers show `og:image` pointing to `localhost`.

**Phase to address:**
Phase 2 (Core Pages) — set `metadataBase` when wiring up the root layout. Verify with social debuggers at the end of Phase 3 (SEO + Launch).

---

### Pitfall 5: Using `"use client"` Everywhere Kills SSG Performance and SEO

**What goes wrong:**
Developers familiar with React (or coming from a Create React App background) reflexively add `"use client"` to any component that uses `useState` or `useEffect`. On a landing page, this turns what should be fully static pre-rendered HTML into client-side-rendered JavaScript bundles. Googlebot may not execute the JS, resulting in blank indexed pages. Core Web Vitals (LCP, FCP) degrade significantly because the page requires a JavaScript parse cycle before content appears.

**Why it happens:**
The `"use client"` directive is a safety valve for interactivity. It is overused when developers don't understand the Server Component default in App Router. Animated sections, scroll effects, and mobile menus all seem to "require" client components — but in most cases, only the interactive fragment needs to be a Client Component, not the entire page.

**How to avoid:**
- Default all page-level components and layout wrappers to Server Components (no directive needed).
- Extract only the interactive fragment (e.g., a mobile hamburger menu toggle, a CTA button with hover state) as a `"use client"` child component.
- Verify the landing page renders with JavaScript disabled: `curl https://dwella.app` should return full HTML with all content, not an empty `<div id="__next">`.
- Run `next build` and check the route annotations — static routes show a `○` symbol.

**Warning signs:**
- `next build` output shows the homepage as `λ` (server-rendered on request) instead of `○` (static).
- Lighthouse SEO score is below 90 despite correct metadata.
- `view-source:` on the production URL shows near-empty HTML body.

**Phase to address:**
Phase 2 (Core Pages). Establish the Server vs. Client Component split from the first component written. Refactoring after the fact is possible but tedious.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode `metadataBase` to production URL | Simple, works immediately | Preview deployments use wrong base URL; OG images broken in PR previews | Never — use env var with fallback instead |
| `"use client"` on entire page components | Avoids thinking about RSC boundaries | Client bundle grows; SSG breaks; SEO degrades | Never for page-level components |
| Single `vercel.json` at repo root | One config file | Conflicts with Expo build settings if Vercel ever indexes the root | Never — keep `vercel.json` inside `website/` |
| No "Ignored Build Step" | Zero setup effort | Burns free tier quota; 100 deploys/day limit hit by RN commits | Never — configure on first deploy |
| Skip `sitemap.xml` for MVP | Saves 30 minutes | Google crawls slowly or misses the privacy policy page (required for App Store review) | Acceptable only if re-added before store submission |
| Inline all styles as `style={}` | Fast to write | Defeats Tailwind/CSS modules tree-shaking; bundle grows; no dark mode later | Only for one-off prototype, remove before Phase 3 |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vercel + monorepo | Setting Root Directory to `website/` and assuming non-website commits are skipped | Also configure "Ignored Build Step" with `git diff HEAD^ HEAD --quiet -- website/` |
| Vercel + environment variables | Setting `NEXT_PUBLIC_SITE_URL` to "All Environments" including Preview | Set the production value for Production only; use Vercel's auto-injected `VERCEL_URL` for Preview builds |
| Next.js `next/image` + external screenshots | Providing a remote URL from Supabase Storage without adding the hostname to `next.config.js` | Add Supabase Storage hostname to `images.remotePatterns` in `next.config.js` before using any remote images |
| App Store download links | Hardcoding Apple/Google store URLs before the app is live | Use environment variables or a redirect layer so URLs can be updated without a redeploy |
| Contact form + Resend/Formspree | Building a full server action for the contact form in Phase 1 | Use a static mailto: link or Formspree embed for MVP; upgrade later if needed |
| Google Fonts via `next/font` | Importing Google Fonts at runtime, bypassing `next/font/google` | Always use `next/font/google` — it self-hosts fonts at build time, eliminating external DNS lookups and layout shifts |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Hero background image not using `priority` prop | LCP image loads late; Lighthouse LCP > 2.5s | Add `priority` to the `<Image>` that is the hero element | Immediately on first page load |
| Unoptimized app screenshot PNGs | Page weight > 2MB; slow mobile load | Export screenshots at 2x retina max, use `next/image` with WebP conversion | When screenshots are > 300KB each |
| Loading all sections as client components | FCP/LCP degraded; JS bundle > 500KB | Keep sections as Server Components; only interactive elements are Client | Any traffic with slow connections |
| No font subsetting | 100–200KB extra font payload | `next/font/google` handles subsetting automatically via `subsets` option | On first load, especially on mobile |
| Third-party analytics script blocking render | TBT > 200ms; INP degraded | Load PostHog (or any analytics) using `next/script` with `strategy="afterInteractive"` | Any page with analytics |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing Supabase anon key in website env vars | Key visible in client bundle; potential abuse | The landing page has NO backend calls — do not add any Supabase SDK or keys to `website/` |
| Contact form without rate limiting | Spam/abuse via open form | Use Formspree (has built-in rate limiting) or add turnstile CAPTCHA if self-hosting form handler |
| Serving privacy policy as client-rendered SPA | Google may not index it; App Store reviewers may see a blank page | Privacy policy must be a static Server Component with full HTML at `view-source:` |
| No `robots.txt` | Crawlers index staging/preview URLs | Add `robots.txt` disallowing preview deployments; only allow production domain |
| `X-Frame-Options` not set | Clickjacking possible on the site | Vercel adds security headers by default, but verify `X-Frame-Options: DENY` is present in response headers |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Navigation menu on the landing page | Visitors distracted from the download CTA; lower conversion | Remove the nav entirely or use a minimal sticky CTA bar; single-goal pages outperform full-nav pages |
| App Store links missing on mobile | Mobile users most likely to download; they bounce if links are broken | Test App Store deep links on a real device before launch; use `target="_blank"` with `rel="noopener"` |
| Screenshots that show an empty/demo state | Visitors can't visualize the product; credibility gap | Use screenshots with realistic sample data (fake tenant names, real payment flows) |
| No social proof section | Visitors have no trust signals; low conversion | Add even 2–3 testimonials or a "landlord managing X properties" stat before launch |
| Page doesn't explain who it's for | Landlords and tenants both exist in the product; confusing positioning | Lead with a landlord-first headline (they pay/sign up); mention tenants as secondary |
| CTA says "Download" with no platform specificity | Users on iOS see both buttons and pick wrong one | Detect `navigator.userAgent` client-side and show only the relevant store button, or show both labeled clearly |

---

## "Looks Done But Isn't" Checklist

- [ ] **OG image:** Verify with https://cards-dev.twitter.com/validator and https://developers.facebook.com/tools/debug/ against the live URL — not just `curl`.
- [ ] **Privacy policy page:** Confirm `view-source:` returns full text content (not a loading spinner requiring JS) — required for Apple App Store review.
- [ ] **sitemap.xml:** Confirm `/sitemap.xml` returns valid XML and includes both `/` and `/privacy` — submit to Google Search Console.
- [ ] **robots.txt:** Confirm `/robots.txt` exists and allows the production domain while disallowing Vercel preview URLs.
- [ ] **App Store links:** Test both iOS (App Store) and Android (Play Store) links on a real device — not just a desktop browser.
- [ ] **Ignored Build Step:** Commit a change to `app/` only and confirm Vercel shows "Skipped Build" in the deployment log.
- [ ] **fonts:** Confirm no render-blocking font requests in Lighthouse — fonts should be self-hosted via `next/font/google`.
- [ ] **JavaScript disabled:** Load the production URL with JS disabled in DevTools — all content should be readable.
- [ ] **Mobile viewport:** Test at 375px (iPhone SE) and 390px (iPhone 15) — not just desktop.
- [ ] **`metadataBase`:** Confirm `next build` produces no `metadataBase` warning in the build output.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Vercel deploys on every commit (no Ignored Build Step) | LOW | Add the `git diff` check to Vercel "Ignored Build Step" setting in the dashboard — no code changes required |
| tsconfig conflict causing build failures | MEDIUM | Create a standalone `website/tsconfig.json`, add `"exclude": ["website"]` to root tsconfig, rerun `tsc --noEmit` from both roots |
| React version mismatch (dual instances) | MEDIUM | Remove `website` from workspaces, install deps fresh in `website/` with `npm install`, pin React version to match Expo |
| `metadataBase` missing from production | LOW | Add the env var to Vercel and `metadataBase` to `layout.tsx`; trigger a new deploy; resubmit to social debuggers |
| All components are `"use client"` | HIGH | Audit each component; remove the directive from any component that does not use hooks or browser APIs; test `next build` route annotations |
| OG image broken after deploy | LOW | Test with Facebook Debugger and Twitter Card Validator; most likely cause is missing `metadataBase` or image behind auth |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Vercel rebuilds on every RN commit | Phase 1 (Project Setup) | Commit a change to `app/` only; confirm "Skipped Build" in Vercel dashboard |
| tsconfig conflict (Expo vs Next.js) | Phase 1 (Project Setup) | Run `npx tsc --noEmit` from repo root and from `website/` independently — zero errors in both |
| React version mismatch | Phase 1 (Project Setup) | `npm ls react` from `website/` shows single version matching Expo's pinned version |
| `metadataBase` not set | Phase 2 (Core Pages) | `next build` log shows no `metadataBase` warning |
| Overuse of `"use client"` | Phase 2 (Core Pages) | `next build` output shows `○ /` (static) not `λ /` (dynamic) |
| Privacy policy not statically rendered | Phase 2 (Core Pages) | `view-source:` on `/privacy` returns full legal text without JS |
| OG image broken in production | Phase 3 (SEO + Launch) | Twitter Card Validator and Facebook Debugger both show correct preview |
| No sitemap submitted | Phase 3 (SEO + Launch) | Google Search Console shows sitemap submitted and indexed |
| App Store links broken on mobile | Phase 3 (SEO + Launch) | Tested on real iOS and Android device |
| Performance traps (LCP > 2.5s) | Phase 3 (SEO + Launch) | Lighthouse mobile LCP < 2.5s, Performance score > 90 |

---

## Sources

- [Vercel Monorepos Documentation](https://vercel.com/docs/monorepos) — official guidance on Root Directory and Ignored Build Step
- [Vercel Monorepos FAQ](https://vercel.com/docs/monorepos/monorepo-faq) — common monorepo deployment questions
- [How to configure Vercel deploys for a monorepo package — DEV Community](https://dev.to/gdbroman/how-to-configure-vercel-deploys-for-a-monorepo-package-4ok1) — Ignored Build Step patterns
- [Expo Work with Monorepos — Expo Documentation](https://docs.expo.dev/guides/monorepos/) — Metro watchFolders and nohoist guidance
- [Expo issues with npm workspaces / monorepos — GitHub Issue #30143](https://github.com/expo/expo/issues/30143) — community-reported hoisting conflicts
- [Next.js Metadata and OG Images — Getting Started](https://nextjs.org/docs/app/getting-started/metadata-and-og-images) — metadataBase requirement
- [Open Graph images using the Next.js App Router — Strongly Typed](https://stronglytyped.uk/articles/open-graph-images-nextjs-app-router) — production OG image pitfalls
- [How to Optimize Core Web Vitals in NextJS App Router for 2025 — Makers' Den](https://makersden.io/blog/optimize-web-vitals-in-nextjs-2025) — LCP/CLS patterns
- [Typical Next.js SEO Pitfalls to Avoid — FocusReactive](https://focusreactive.com/typical-next-js-seo-pitfalls-to-avoid-in-2024/) — client-side rendering SEO failures
- [10 Landing Page Mistakes You Should Absolutely Avoid in 2025 — Moosend](https://moosend.com/blog/landing-page-mistakes/) — UX and conversion pitfalls

---
*Pitfalls research for: Next.js landing page added to React Native + Expo monorepo*
*Researched: 2026-03-30*
