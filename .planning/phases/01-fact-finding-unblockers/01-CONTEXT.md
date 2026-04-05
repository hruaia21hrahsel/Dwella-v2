# Phase 1: Fact-Finding & Unblockers - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Resolve audit questions and ship trivial unblockers so downstream legal, compliance, and store phases have ground truth to build on. This is an evidence-gathering and administrative phase — NOT a redesign, NOT a code-refactor, NOT a legal-drafting phase. Every output is either (a) a fact written into a document or (b) a tiny cleanup commit.

**In scope:** Supabase region lookup, Anthropic DPA signing, NoBroker file deletion, Dwella trademark clearance memo, THIRD-PARTY-LICENSES.md creation, cookie/tracker attestation, logo/icon provenance memo.

**Out of scope:** Privacy policy drafting (Phase 2), cookie consent UI (Phase 2+), icon redesign (Phase 6/STORE), any SEC-* hardening (Phase 3), full SCA tooling integration.

</domain>

<decisions>
## Implementation Decisions

### Trademark Clearance (IP-01)
- **D-01:** DIY free-search memo for India + EU + US. Zero budget — solo developer, no attorney.
- **D-02:** Search sources (all free public portals):
  - **US:** USPTO TESS (`https://tmsearch.uspto.gov/`) — exact match for "Dwella" in all international classes, plus phonetic near-matches ("Dwela", "Dwellar", "Dwell", "Dwellah") in Class 9 (software) and Class 36 (real estate).
  - **EU:** EUIPO eSearch Plus (`https://euipo.europa.eu/eSearch/`) — same search terms, same classes, EU-wide coverage.
  - **India:** Indian IP Office public search (`https://tmrsearch.ipindia.gov.in/eregister/`) — Wordmark search, same terms.
- **D-03:** Memo output: `.planning/legal/trademark-clearance-dwella.md`. Must contain: date of search, exact URL + query for each jurisdiction, screenshot (or text export) of results page, conflict-finding summary (none / near-match / exact conflict), and a go/no-go conclusion per jurisdiction.
- **D-04:** If ANY exact conflict is found in software (Class 9) or real-estate (Class 36) classes in any of the 3 jurisdictions → STOP the phase, escalate to user, do NOT mark IP-01 complete. Phonetic near-matches in unrelated classes → record and proceed.
- **D-05:** Attorney review explicitly deferred until post-launch or until a conflict surfaces. Not a blocker for v1.0.

### NoBroker Removal (IP-02)
- **D-06:** Delete `dwella-nobroker-teal.jsx` from repo root.
- **D-07:** Run `grep -ri "nobroker" . --exclude-dir=node_modules --exclude-dir=.git` and delete every other tracked file that matches. Verify final state returns zero matches.
- **D-08:** Git history is NOT rewritten. Rationale: (a) rewriting main is destructive and invalidates any local clones on other machines, (b) the GitHub repo is public so history is already indexed externally, (c) shipped artifacts (IPA/APK) contain no history, so IP risk is tied to working-tree state only.
- **D-09:** Repo is NOT renamed (already `Dwella-v2`, no NoBroker branding in the name).

### Third-Party License Audit (IP-03 + IP-05)
- **D-10:** Tooling: `npx license-checker-rseidelsohn --production --json > .planning/legal/npm-licenses.json` (dev dependencies excluded — they don't ship in the bundle).
- **D-11:** GPL/AGPL detection: grep the output JSON for `GPL`, `AGPL`, `LGPL`, `SSPL`. ANY match → flag as a blocker, STOP phase, escalate. LGPL in a dynamically-linked JS context is usually safe but requires a case-by-case call — flag regardless.
- **D-12:** Asset audit: manually enumerate every file under `assets/`, `constants/icons/` (or wherever icon assets live), and any embedded font files. For each: source, license, attribution requirement (if any). Covers: app icon, splash, logos, illustrations, any stock imagery, any embedded fonts beyond system fonts.
- **D-13:** Output: `THIRD-PARTY-LICENSES.md` at repo root. Structure: one section for npm deps (auto-generated from license-checker JSON, grouped by license type), one section for assets (manual), one section for fonts (manual). Include a "no GPL/AGPL contamination" attestation at the top.
- **D-14:** Google Fonts / system fonts: if the app uses Google Fonts via `@expo-google-fonts/*`, those are SIL OFL — enumerate them explicitly with the OFL reference.

### Anthropic DPA (COMP-06)
- **D-15:** Self-serve path via `console.anthropic.com` → Settings → Compliance (or Legal). Download the standard DPA PDF.
- **D-16:** Sign via DocuSign OR print-sign-scan. Store countersigned copy at `.planning/legal/anthropic-dpa-signed.pdf`. Record the signing date and the DPA version number in `.planning/legal/dpa-register.md`.
- **D-17:** Supabase DPA: Supabase's standard DPA is incorporated by reference in their Terms of Service (`https://supabase.com/legal/dpa`). Record the URL + the "last updated" date in the same `dpa-register.md`. No signing action required for Supabase — just evidence-capture.
- **D-18:** Custom/negotiated DPAs are NOT pursued. Self-serve covers GDPR Art 28 obligations.

### Supabase Region Confirmation (COMP-05)
- **D-19:** Log in to Supabase dashboard → Project Settings → General → Region. Record the exact region string (e.g., `ap-south-1`, `eu-west-1`, `us-east-1`) AND the provider (AWS/GCP/Fly).
- **D-20:** Write the region into `.planning/PROJECT.md` under a new "Infrastructure" section.
- **D-21:** Write cross-border transfer analysis into `.planning/legal/cross-border-transfers.md`. Content depends on region:
  - If region is in EU → baseline case, no transfer from EU users. Document as "EU users: in-region; non-EU users: GDPR Ch V transfer to EU (adequacy not required as destination is EU)."
  - If region is outside EU (e.g., ap-south-1, us-east-1) → explicit SCC-based transfer language. Document as "EU users' data transferred to {region} under GDPR Art 46 Standard Contractual Clauses (incorporated via Supabase DPA)."
  - India users under DPDP Act 2023 → cross-border transfer permitted by default under current rules (not yet notified as restricted country); document explicitly.
- **D-22:** This memo feeds directly into LEGAL-02 (privacy policy) in a later phase.

### Cookie / Tracker Audit (COMP-10)
- **D-23:** Static audit: grep `package.json` AND `ios/Podfile.lock` AND `android/app/build.gradle` (if they exist — Expo managed workflow may not have them) for known tracker SDK names: `sentry`, `posthog`, `amplitude`, `mixpanel`, `segment`, `firebase-analytics`, `google-analytics`, `branch`, `adjust`, `appsflyer`, `singular`, `kochava`, `facebook`, `react-native-fbsdk`.
- **D-24:** Runtime audit: launch the app on a real or simulated device, perform a typical user journey (login → view properties → view payment → open bot → log out) for ~60 seconds. Capture network traffic via Expo DevTools Network tab OR Charles/mitmproxy if DevTools is insufficient. Export the list of unique hostnames contacted.
- **D-25:** Accepted hostnames: `*.supabase.co`, `*.supabase.in`, `api.telegram.org`, `api.anthropic.com`, Apple/Google push endpoints (`*.push.apple.com`, `fcm.googleapis.com`), CDN domains for any explicit deps (e.g., `*.expo.dev`). ANY other hostname → flag for investigation.
- **D-26:** Output: `.planning/legal/tracker-audit.md` — one-page attestation with static-grep evidence, runtime-capture evidence (hostname list), and a "no third-party analytics, no ads, no silent trackers" conclusion. Date and sign (solo dev attestation).

### Logo / Icon Provenance (IP-04)
- **D-27:** Fact-finding only. Do NOT regenerate any icons in this phase (that's STORE phase scope).
- **D-28:** For each of: app icon (`assets/icon.png` or wherever), adaptive icon (Android), splash image, any in-app logo assets — document: (a) who created it, (b) what tool, (c) any source license or commercial-use terms, (d) date of creation/import.
- **D-29:** If any asset is AI-generated (Midjourney/DALL-E/Stable Diffusion/Ideogram): record the exact prompt if recoverable, the tool's commercial-use terms at time of generation, and flag for user review. Some AI tools (e.g., Midjourney free tier) don't grant commercial rights.
- **D-30:** If provenance is unknown/unrecoverable for any asset → flag as a blocker in the memo and escalate to the user. Do not silently invent provenance.
- **D-31:** Output: `.planning/legal/asset-provenance.md`.

### Claude's Discretion
- Exact file layout inside `.planning/legal/` (flat vs. nested).
- Whether to consolidate the DPA register, cross-border memo, and tracker audit into a single file or keep them split (planner decides based on length).
- Shell command specifics for grep patterns.
- Whether to capture trademark search evidence as screenshots (PNG) or text exports (MD) — both are valid, planner picks based on what's scriptable.

### Folded Todos
None — no pending todos matched this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Vision, stack, publisher identity (solo developer), global-launch stance. Will be updated by this phase (Infrastructure section for Supabase region).
- `.planning/REQUIREMENTS.md` §§ COMP-05, COMP-06, COMP-10, IP-01, IP-02, IP-03, IP-04, IP-05 — the 8 requirements this phase must close.
- `.planning/ROADMAP.md` Phase 1 section — canonical goal + success criteria.

### External legal/regulatory references (read-only, not in repo)
- GDPR Article 28 (processor obligations) — informs what Anthropic DPA must cover.
- GDPR Article 46 (transfer mechanisms — SCCs) — informs cross-border memo language.
- DPDP Act 2023 §16 (cross-border transfer rules for India) — informs India transfer language.
- Supabase DPA: `https://supabase.com/legal/dpa` — record URL + version in dpa-register.md.
- Anthropic DPA: self-serve via `console.anthropic.com` Settings → Compliance.

### Outputs this phase WRITES (planner should reference these paths in task outputs)
- `.planning/legal/trademark-clearance-dwella.md`
- `.planning/legal/anthropic-dpa-signed.pdf`
- `.planning/legal/dpa-register.md`
- `.planning/legal/cross-border-transfers.md`
- `.planning/legal/npm-licenses.json`
- `.planning/legal/tracker-audit.md`
- `.planning/legal/asset-provenance.md`
- `THIRD-PARTY-LICENSES.md` (repo root)

No external ADRs or design specs exist for this phase — it's fact-gathering, not implementation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json` — authoritative dep list for license-checker and static tracker grep.
- `.env` / `constants/config.ts` — confirms Supabase URL (not region directly, but dashboard lookup is trivial).
- Expo managed workflow — likely NO native `ios/` or `android/` directories, so static grep target is primarily `package.json` + `app.json` + any `expo-*` plugin configs.

### Established Patterns
- Per memory: Sentry and PostHog were already fully removed from the project (not just disabled). Cookie/tracker audit should come back clean from static grep — the runtime capture is the stronger evidence.
- Per memory: `dwella-nobroker-teal.jsx` exists at repo root — confirmed target for IP-02.
- Per memory: Expo SDK pinned at `~54.0.0`, React Native Paper UI, Supabase JS client, Zustand auth store.
- Per memory: Edge functions on main use `@expo-google-fonts/*` (likely) — license audit must enumerate these as SIL OFL.

### Integration Points
- `.planning/PROJECT.md` — phase writes an "Infrastructure" section with Supabase region.
- `.planning/REQUIREMENTS.md` — phase flips 8 checkboxes from `[ ]` to `[x]` on completion.
- `.planning/STATE.md` — phase updates status/Last Activity.

### Blockers / Manual Steps (non-autonomous tasks)
Several tasks CANNOT be automated by an executor agent and must be flagged `autonomous: false`:
1. **Supabase dashboard lookup (COMP-05)** — requires human login.
2. **Anthropic DPA download + signature (COMP-06)** — requires human login + signature.
3. **Trademark searches (IP-01)** — require human browser interaction with USPTO/EUIPO/Indian IP Office portals (CAPTCHAs, JS-heavy UIs).
4. **Runtime tracker capture (COMP-10)** — requires the app actually running on a device with dev tools attached.
5. **Asset provenance memo (IP-04)** — requires human knowledge of which tool created which asset.

Tasks 1-5 above need a CHECKPOINT task pattern: executor prepares the scaffold file, user fills in the data, executor verifies and commits. Planner must structure these as two-task pairs: (a) `scaffold-<name>.md` (autonomous) → (b) `verify-<name>-complete.md` (autonomous, checks file has content and commits).

</code_context>

<specifics>
## Specific Ideas

- **License checker tool choice:** `license-checker-rseidelsohn` (maintained fork of `license-checker`) preferred over base `license-checker` which is unmaintained. Use `--production` flag to exclude devDeps from the attestation.
- **Trademark search wording:** search stem "Dwella" AND phonetic near-matches ("Dwela", "Dwellar", "Dwell", "Dwellah") in each jurisdiction. Stop searches at Class 9 (software) and Class 36 (real estate/property management) to bound scope.
- **DPA filing discipline:** every DPA/DPA-equivalent reference goes into one `dpa-register.md` file so downstream privacy-policy drafting (Phase 2) has a single source of truth for the sub-processor list.
- **Blocker discipline:** trademark conflicts and GPL/AGPL contamination are the two hard-STOP conditions in this phase. Everything else is evidence-capture that can proceed in parallel.

</specifics>

<deferred>
## Deferred Ideas

- **Ongoing trademark monitoring service** (Markify/Trademarkia) — out of scope for v1.0 launch, reconsider post-launch if budget exists.
- **Full SCA tooling (FOSSA/ScanCode Toolkit)** — overkill for current React Native codebase with no native vendored code. Revisit if we add native modules.
- **Git history rewrite to scrub NoBroker** — destructive, provides no real protection, not done.
- **Icon redesign for AI-provenance cleanup** — belongs in STORE phase (6) if IP-04 memo surfaces risky AI-generated assets.
- **Attorney review of trademark clearance** — deferred until post-launch or until a conflict surfaces.
- **mitmproxy full session capture** — Expo DevTools network tab is sufficient for the attestation; mitmproxy only if DevTools proves insufficient.

### Reviewed Todos (not folded)
None reviewed — no pending todos matched Phase 1.

</deferred>

---

*Phase: 01-fact-finding-unblockers*
*Context gathered: 2026-04-05*
