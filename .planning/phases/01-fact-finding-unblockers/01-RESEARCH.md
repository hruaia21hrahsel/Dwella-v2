# Phase 1: Fact-Finding & Unblockers - Research

**Researched:** 2026-04-05
**Domain:** Legal/compliance evidence-gathering for React Native + Expo mobile app pre-launch
**Confidence:** HIGH (most decisions are mechanical; two materially change from CONTEXT.md)

## Summary

Phase 1 is an administrative evidence-gathering phase with 31 locked decisions in CONTEXT.md. Research confirms most decisions are executable as written, but surfaces **two material corrections** the planner MUST apply before writing tasks, plus several tactical refinements (tool flags, URL changes, and the project's actual file surface).

**Two material corrections:**

1. **D-15/D-16 (Anthropic DPA) is wrong as written.** The Anthropic DPA is NOT downloaded and signed via a self-serve path in `console.anthropic.com`. It is **automatically incorporated by reference** into the Commercial Terms of Service and viewable at a public URL. Acceptance happens when you accept the Commercial Terms. There is no PDF to countersign. Phase 1 must pivot to: "capture evidence that the Commercial Terms (which incorporate the DPA) have been accepted for this account" plus "archive a copy of the public DPA PDF with the version date." See the Anthropic DPA section below. `[VERIFIED: privacy.claude.com article 7996862]`

2. **D-02 (USPTO TESS) is a dead URL.** USPTO retired TESS on **November 30, 2023** and replaced it with a new cloud-based Trademark Search system at `https://tmsearch.uspto.gov/search/` (the legacy TESS host still redirects for now but the underlying system is the new one). The CONTEXT.md URL `https://tmsearch.uspto.gov/` happens to still resolve to the replacement, but the UI, search syntax, and features are completely different from TESS. Planner should reference "USPTO Trademark Search (post-TESS)" and document the new query syntax in the task. `[VERIFIED: uspto.gov retirement notice + altlegal.com writeup]`

**Non-material refinements (described in sections below):**
- The project is **NOT** pure Expo managed workflow. `android/app/build.gradle` and `android/build.gradle` exist on disk (prebuild output committed to repo). An `ios/` directory does **NOT** exist. This expands the D-23 static-grep surface. `[VERIFIED: filesystem scan 2026-04-05]`
- `@expo-google-fonts/*` is **not** in `package.json`. D-14's SIL OFL attestation is unnecessary — remove it. Custom fonts would have to come from `assets/` instead. `[VERIFIED: package.json scan 2026-04-05]`
- `license-checker-rseidelsohn` flag set and gotchas confirmed.
- C2PA-based AI asset provenance detection is possible but unreliable (metadata is easily stripped). Worth a 5-minute check, not a substitute for human memory.

**Primary recommendation:** Planner should structure all 8 phase requirements as **scaffold/verify two-task pairs** for any decision that touches a human-gated system (Supabase dashboard, browser trademark portals, runtime app capture, asset memory). Autonomous tasks handle the mechanical work (file scaffolds, grep audits, license-checker run, NoBroker deletion). Human-gated work is split into a deterministic scaffold step and a deterministic verification step that asserts the human did their part before committing.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Trademark Clearance (IP-01):**
- **D-01:** DIY free-search memo for India + EU + US. Zero budget — solo developer, no attorney.
- **D-02:** Search sources — US: USPTO TESS `https://tmsearch.uspto.gov/`; EU: EUIPO eSearch Plus `https://euipo.europa.eu/eSearch/`; India: Indian IP Office `https://tmrsearch.ipindia.gov.in/eregister/`. Exact match "Dwella" + phonetic near-matches ("Dwela", "Dwellar", "Dwell", "Dwellah"), Class 9 (software) and Class 36 (real estate).
- **D-03:** Memo output `.planning/legal/trademark-clearance-dwella.md` with date, URL+query per jurisdiction, screenshot/text export, conflict-finding summary, go/no-go conclusion per jurisdiction.
- **D-04:** ANY exact conflict in Class 9 or 36 in any jurisdiction → STOP phase, escalate, do NOT mark IP-01 complete. Phonetic near-matches in unrelated classes → record and proceed.
- **D-05:** Attorney review deferred until post-launch or conflict surfaces.

**NoBroker Removal (IP-02):**
- **D-06:** Delete `dwella-nobroker-teal.jsx` from repo root.
- **D-07:** `grep -ri "nobroker" . --exclude-dir=node_modules --exclude-dir=.git` and delete every other tracked file that matches. Final state: zero matches.
- **D-08:** Git history NOT rewritten (public repo, history externally indexed, ship artifacts contain no history).
- **D-09:** Repo NOT renamed (already `Dwella-v2`).

**Third-Party License Audit (IP-03 + IP-05):**
- **D-10:** `npx license-checker-rseidelsohn --production --json > .planning/legal/npm-licenses.json`.
- **D-11:** Grep output JSON for `GPL`, `AGPL`, `LGPL`, `SSPL`. ANY match → blocker, STOP, escalate. LGPL flagged regardless.
- **D-12:** Manual asset enumeration under `assets/`, `constants/icons/` (or wherever), any embedded font files. For each: source, license, attribution, date.
- **D-13:** Output `THIRD-PARTY-LICENSES.md` at repo root with npm section (auto-generated, grouped by license), assets section (manual), fonts section (manual), and a "no GPL/AGPL contamination" attestation.
- **D-14:** If `@expo-google-fonts/*` used, enumerate as SIL OFL.

**Anthropic DPA (COMP-06):**
- **D-15:** Self-serve path via `console.anthropic.com` → Settings → Compliance/Legal. Download DPA PDF.
- **D-16:** Sign via DocuSign or print-sign-scan. Store at `.planning/legal/anthropic-dpa-signed.pdf`. Record signing date + DPA version in `.planning/legal/dpa-register.md`.
- **D-17:** Supabase DPA at `https://supabase.com/legal/dpa`. Record URL + last-updated date. No signing.
- **D-18:** No custom/negotiated DPAs.

**Supabase Region (COMP-05):**
- **D-19:** Dashboard → Project Settings → General → Region. Record exact region string + provider (AWS/GCP/Fly).
- **D-20:** Write region into `.planning/PROJECT.md` new "Infrastructure" section.
- **D-21:** Write cross-border analysis into `.planning/legal/cross-border-transfers.md`, content depending on region (EU vs. non-EU vs. India-DPDP language).
- **D-22:** Memo feeds LEGAL-02 in Phase 2.

**Cookie/Tracker Audit (COMP-10):**
- **D-23:** Static grep `package.json` + `ios/Podfile.lock` + `android/app/build.gradle` (if they exist) for: `sentry`, `posthog`, `amplitude`, `mixpanel`, `segment`, `firebase-analytics`, `google-analytics`, `branch`, `adjust`, `appsflyer`, `singular`, `kochava`, `facebook`, `react-native-fbsdk`.
- **D-24:** Runtime audit via Expo DevTools Network tab or Charles/mitmproxy. ~60 second user journey. Export hostname list.
- **D-25:** Accepted hostnames: `*.supabase.co`, `*.supabase.in`, `api.telegram.org`, `api.anthropic.com`, `*.push.apple.com`, `fcm.googleapis.com`, `*.expo.dev`. Any other → flag.
- **D-26:** Output `.planning/legal/tracker-audit.md` one-page attestation.

**Logo/Icon Provenance (IP-04):**
- **D-27:** Fact-finding only. No icon regeneration in this phase.
- **D-28:** For each of app icon, adaptive icon, splash, in-app logos: document creator, tool, license, date.
- **D-29:** AI-generated assets: record prompt if recoverable, tool's commercial-use terms at time of generation, flag for user review.
- **D-30:** Unknown provenance → blocker, escalate. No inventing provenance.
- **D-31:** Output `.planning/legal/asset-provenance.md`.

### Claude's Discretion
- Exact file layout inside `.planning/legal/` (flat vs. nested).
- Consolidation of DPA register + cross-border memo + tracker audit into one file or split.
- Grep command specifics.
- Trademark search evidence format (PNG screenshot vs. MD text export).

### Deferred Ideas (OUT OF SCOPE)
- Ongoing trademark monitoring service.
- Full SCA tooling (FOSSA/ScanCode).
- Git history rewrite.
- Icon redesign (belongs in Phase 6 STORE).
- Attorney review.
- mitmproxy full session capture (only if DevTools insufficient).
- Privacy policy drafting (Phase 2), cookie consent UI (Phase 2+), icon redesign (Phase 6), any SEC-* hardening (Phase 3).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-05 | Supabase region confirmed + cross-border memo | Region lookup is dashboard-gated (non-autonomous). Cross-border memo templates provided below keyed off region. |
| COMP-06 | Anthropic DPA "signed" + Supabase DPA URL recorded | **CORRECTION: no signing workflow exists.** See Anthropic DPA Reality section. Supabase DPA URL + latest version (March 17, 2026 per filename `Supabase+DPA+260317.pdf`) verified live. |
| COMP-10 | Cookie/tracker attestation | Static-grep patterns + hostname allowlist + DevTools export path documented. |
| IP-01 | Dwella trademark clearance memo (IN/EU/US) | USPTO TESS dead — new system documented. EUIPO + IP India URLs confirmed live. Nice Class 9 + 36 scope confirmed correct. |
| IP-02 | Delete `dwella-nobroker-teal.jsx` + zero NoBroker refs | File confirmed present at repo root. Current grep finds 10 matches — 2 in source files (`dwella-nobroker-teal.jsx`, `constants/colors.ts`), 8 in planning/docs. `constants/colors.ts` is a code file that must be inspected before blind deletion. Planning docs are documentation and should be excluded from the cleanup grep (they legitimately describe the removal). |
| IP-03 | `THIRD-PARTY-LICENSES.md` with no GPL/AGPL | `license-checker-rseidelsohn` flag set confirmed. Simple markdown format recommended (CycloneDX/SPDX is overkill for solo mobile dev). |
| IP-04 | Logo/icon provenance memo | 4 assets confirmed: `icon.png`, `adaptive-icon.png`, `splash.png`, `favicon.png`, `images/logo.png`. C2PA check can be attempted but is unreliable. |
| IP-05 | Asset license enumeration | Folds into IP-03 output structure. |

## Standard Stack

### Core Tools for This Phase

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `license-checker-rseidelsohn` | latest via `npx` | npm license audit (production deps only) | Maintained fork of the abandoned `davglass/license-checker`; preferred by ecosystem since 2022. `[VERIFIED: npmjs.com]` |
| `grep` / `ripgrep` | system | Static audit of `package.json`, `app.json`, `android/app/build.gradle` for tracker SDKs and NoBroker refs | Standard Unix tool; already assumed present. `[VERIFIED: platform]` |
| Supabase Dashboard (web) | — | Region lookup | Only source of truth; non-autonomous. |
| `console.anthropic.com` | — | Capture evidence of Commercial Terms acceptance | Not a DPA download tool — see correction. |
| Browser (for USPTO / EUIPO / IP India) | — | Trademark search | Portals have CAPTCHAs and JS-heavy UIs, non-automatable. |
| React Native DevTools (Network tab) | ships with Expo SDK 54 | Runtime hostname capture | Open with `j` keybind in the `expo start` terminal. `[VERIFIED: docs.expo.dev/debugging/tools]` |

### license-checker-rseidelsohn Usage (D-10 refinement)

**Canonical install/run pattern:** Use `npx` (no install needed):

```bash
npx license-checker-rseidelsohn --production --json --out .planning/legal/npm-licenses.json
```

**Flags explained** `[VERIFIED: npmjs.com/package/license-checker-rseidelsohn]`:
- `--production` — excludes devDependencies. Critical: devDeps don't ship in the bundle, so their licenses don't create obligations on the shipped artifact.
- `--json` — machine-readable output (the `--summary` form is unsuitable for automated GPL detection).
- `--out <path>` — writes to file without also printing to stdout (cleaner for CI).

**Known gotchas:**
- **Workspaces:** License checker has had known issues with npm/yarn/pnpm workspaces (`github.com/RSeidelsohn/license-checker-rseidelsohn issue #36`). Dwella v2 is **NOT a workspace monorepo** (`package.json` has no `workspaces` field) — so this does not apply. `[VERIFIED: package.json]`
- **`optionalDependencies`:** `sharp` is listed as optional. `--production` includes optional deps. If sharp is not actually bundled (it's a build-time optimization), the planner may want to document it as "listed but not bundled" in the attestation.
- **License field format:** Some packages report license as a string (`"MIT"`), some as an SPDX expression (`"(MIT OR Apache-2.0)"`), some as an object. Grep regex must handle all three.

### GPL/AGPL/LGPL/SSPL Detection Patterns (D-11 refinement)

Run against the JSON output file:

```bash
# Primary regex — case-insensitive, word boundaries, covers SPDX expressions
grep -iE '"(licenses?|license)": *"[^"]*\b(A?GPL|LGPL|SSPL)[^"]*"' .planning/legal/npm-licenses.json

# Belt-and-braces — jq query that handles object-form license fields too
jq '[.[] | select((.licenses // "" | tostring) | test("GPL|AGPL|LGPL|SSPL"; "i"))]' .planning/legal/npm-licenses.json
```

**Exit code discipline:** The grep MUST return non-zero (no matches) for the phase to proceed. Wrap it in:

```bash
if grep -iE '"(licenses?|license)": *"[^"]*\b(A?GPL|LGPL|SSPL)[^"]*"' .planning/legal/npm-licenses.json; then
  echo "BLOCKER: GPL/AGPL/LGPL/SSPL license found — STOP and escalate"
  exit 1
fi
```

`[ASSUMED]` The exact match patterns above. Based on inspection of typical `license-checker-rseidelsohn` JSON output structure, but not test-run against Dwella's actual dep tree in this session — planner should include a test-run task.

### THIRD-PARTY-LICENSES.md Format

**Recommendation: plain markdown.** `[ASSUMED based on ecosystem norms]` Neither SPDX 2.3 JSON nor CycloneDX SBOM provide meaningful value to a solo dev shipping a mobile app. Both are designed for supply-chain attestation to enterprise customers; mobile app stores don't consume them. The consumers of Dwella's license file are (a) the solo dev's own future self, (b) any lawyer reviewing for a pre-launch check, (c) contributors. All three prefer readable markdown.

**Structure:**

```markdown
# Third-Party Licenses

This app (Dwella v1.0) bundles the following third-party software and assets.
We attest that no GPL, AGPL, LGPL, or SSPL licensed code ships in the app bundle.

## npm Runtime Dependencies

Auto-generated from `license-checker-rseidelsohn --production` on {date}.
Source: `.planning/legal/npm-licenses.json`

### MIT (n packages)
- <name>@<version> — <repo URL>
- ...

### Apache-2.0 (n packages)
- ...

### ISC / BSD-3-Clause / etc.
- ...

## Fonts
(none bundled — app uses system fonts via React Native Paper defaults)

## Images and Icons
- `assets/icon.png` — see `.planning/legal/asset-provenance.md`
- ...

---
Generated: {date}
Attestation signed: {developer name}, solo publisher
```

## Architecture Patterns

### Pattern: Scaffold / Verify Two-Task Pairs (CRITICAL for this phase)

Several Phase 1 tasks cannot be executed by an autonomous agent because they require human action against external systems. The GSD idiom is **two tasks per non-autonomous decision:**

**Task A (autonomous):** `scaffold-<name>`
- Creates the target file with placeholder fields and explicit human-action checklist.
- Example: creates `.planning/legal/cross-border-transfers.md` with `{REGION}` and `{PROVIDER}` placeholders, a `## Human Action Required` block at the top listing "1. Log into Supabase dashboard, 2. Navigate to Project Settings → General, 3. Copy the exact region string and provider, 4. Replace {REGION} and {PROVIDER} above, 5. Delete this block."
- Commits the scaffold.

**Task B (autonomous):** `verify-<name>-complete`
- Asserts the scaffold file no longer contains `{REGION}`, `{PROVIDER}`, or the `## Human Action Required` sentinel block.
- Asserts the file contains content matching an expected regex (e.g., region string matches one of the known Supabase region formats: `/^(us|eu|ap|sa)-[a-z]+-\d+$/`).
- Optionally commits a "verified" marker comment.
- Fails the task (non-zero exit) if verification fails, prompting human intervention.

**Mapping to Phase 1:**

| Decision | Task A (scaffold) | Task B (verify) |
|----------|-------------------|-----------------|
| D-19/20/21 Supabase region | Scaffold `cross-border-transfers.md` + empty PROJECT.md infra section | Verify no placeholders remain, region string matches known format |
| D-15/16 Anthropic DPA | Scaffold `dpa-register.md` with Anthropic + Supabase rows | Verify Anthropic row has date filled (corrected: "Commercial Terms accepted on {date}", not "DPA signed on") |
| D-02/03 Trademark searches | Scaffold `trademark-clearance-dwella.md` with 3 jurisdiction sections | Verify each jurisdiction section has URL, query, result summary, go/no-go conclusion |
| D-24 Runtime tracker capture | Scaffold `tracker-audit.md` with static-grep section auto-filled, runtime section as placeholder | Verify hostname list present, all hostnames match allowlist or are flagged |
| D-28 Asset provenance | Scaffold `asset-provenance.md` with one row per asset file auto-enumerated from `assets/` | Verify every row has creator/tool/license/date fields filled |

**Autonomous tasks (no pair needed):**
- D-06/07 NoBroker deletion — mechanical.
- D-10 license-checker run — mechanical.
- D-11 GPL grep — mechanical.
- D-13 THIRD-PARTY-LICENSES.md generation — mechanical from JSON.

### Project Structure for Legal Artifacts

Recommended (Claude's discretion per CONTEXT.md):

```
.planning/legal/
├── trademark-clearance-dwella.md
├── dpa-register.md                  # consolidates Anthropic + Supabase DPA refs
├── cross-border-transfers.md         # COMP-05 memo
├── tracker-audit.md                  # COMP-10 attestation
├── asset-provenance.md               # IP-04 memo
├── npm-licenses.json                 # raw license-checker output
└── anthropic-commercial-terms-evidence.md  # REPLACES anthropic-dpa-signed.pdf (see correction)

THIRD-PARTY-LICENSES.md               # repo root, user-facing
```

**Decision made:** Keep artifacts as separate files rather than consolidating. Rationale: Phase 2 (privacy policy drafting) needs to reference individual memos in its sub-processor list, and a single mega-file would mix unrelated concerns. Each memo is <2 pages so fragmentation cost is low.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| npm license aggregation | Custom `package.json` parser + registry lookup | `license-checker-rseidelsohn` | License field has 3 forms (string, object, SPDX expression), dep tree has peer/optional edge cases, transitive resolution matters |
| SPDX license classification | Manual "is this GPL" matcher | SPDX-compliant regex against license-checker JSON | SPDX expressions like `(MIT OR GPL-3.0)` create false-positive risk for naive substring match |
| C2PA AI-content detection | Custom EXIF parser | `c2patool` CLI or skip entirely | C2PA is easily stripped, unreliable as proof-of-non-AI. Use only as supplementary evidence. `[VERIFIED: c2pa.org FAQ]` |
| Trademark similarity scoring | Custom phonetic match (Soundex/Metaphone) | Manual search of 4-5 pre-agreed variants | USPTO/EUIPO have their own fuzzy-match under the hood; hand-rolled phonetics add nothing and risk false confidence |
| Runtime network capture | Custom HTTP interceptor | React Native DevTools Network tab (Expo SDK 54 built-in) | DevTools Network panel is supported in Expo apps; no install needed |

## Anthropic DPA Reality (CORRECTION to D-15/D-16)

**Fact** `[VERIFIED: privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa, fetched 2026-04-05]`:

> "Anthropic's DPA with Standard Contractual Clauses (SCCs) is automatically incorporated into our Commercial Terms of Service. When you accept Anthropic's Commercial Terms of Service, you also accept the DPA."

The DPA is publicly viewable at `https://www.anthropic.com/legal/data-processing-addendum`. There is **no separate download + signature workflow** in the console. Settings → Compliance/Legal does not exist as described in CONTEXT.md D-15.

**What the planner should do instead** (this is the corrected workflow):

1. **Verify the account is on Commercial Terms, not Consumer Terms.** Log into `console.anthropic.com`, check that the active plan is API / Team / Enterprise (not the free consumer claude.ai plan). API usage for Dwella bot traffic = Commercial Terms, so this should be the case — but it must be captured as evidence.

2. **Capture a dated screenshot** of the account's Commercial Terms acceptance (visible in Settings → Billing or similar — exact location varies, planner should not hard-code it).

3. **Archive the public DPA PDF** at `.planning/legal/anthropic-dpa-public-{YYYY-MM-DD}.pdf` by downloading from `https://www.anthropic.com/legal/data-processing-addendum`. Record the DPA's own "Last updated" or "Version" date from the document header.

4. **Record in `dpa-register.md`:**

```markdown
### Anthropic
- **Status:** Incorporated by reference via Commercial Terms of Service acceptance
- **Terms accepted on:** {date, from account evidence}
- **Public DPA URL:** https://www.anthropic.com/legal/data-processing-addendum
- **DPA version archived:** `.planning/legal/anthropic-dpa-public-{date}.pdf`
- **DPA "Last Updated" per document:** {date from PDF header}
- **Account evidence:** {screenshot path or billing export path}
- **Signing mechanism:** N/A — incorporation by reference (no countersigning workflow exists)
```

5. **Delete the `.planning/legal/anthropic-dpa-signed.pdf` reference from CONTEXT.md canonical_refs** — that file will never exist.

**Impact on COMP-06 verification:** The requirement text says "Data Processing Addendum (DPA) signed with Anthropic." Strict reading: this is not achievable because Anthropic does not offer signing. Spirit of the requirement is satisfied by the incorporation-by-reference evidence above. Planner should note this in the requirement closeout so future auditors don't look for a non-existent signed PDF.

## Supabase DPA Reference

`[VERIFIED: supabase.com/legal/dpa 2026-04-05]`

- Canonical URL: `https://supabase.com/legal/dpa`
- Latest version: **March 17, 2026** (per the downloadable filename `Supabase+DPA+260317.pdf` at `https://supabase.com/downloads/docs/Supabase+DPA+260317.pdf`). Previous version was `Supabase+DPA+250314.pdf` (March 14, 2025).
- Signing: Supabase also offers a PandaDoc-based signed version via request from dashboard → Legal Documents, but this is optional. CONTEXT.md D-17 correctly states "no signing action required" — the incorporated-by-reference DPA already covers GDPR Art 28.
- **Recommendation:** Archive the PDF to `.planning/legal/supabase-dpa-2026-03-17.pdf` alongside the register entry for durability (public URL could move).

## Trademark Search URLs (2026 Status)

### US — USPTO (**MATERIAL CHANGE from D-02**)

`[VERIFIED: uspto.gov/subscription-center/2023/retiring-tess-what-know-about-new-trademark-search-system]`

- **TESS was retired November 30, 2023.** The URL `https://tmsearch.uspto.gov/` may still resolve but the interface, query syntax, and features are the new cloud-based system — NOT the old TESS.
- **Current canonical URL:** `https://tmsearch.uspto.gov/search/search-information` or `https://www.uspto.gov/trademarks/search` as the entry point.
- **New system features:** Industry-standard search syntax, both basic and advanced interfaces, AI image search (supplemental — USPTO themselves note it does not replace traditional clearance).
- **Search strategy for Phase 1:**
  1. Basic search: exact match `"Dwella"` across all classes → capture hit count.
  2. Advanced search with Nice Class filter `IC 009` (software/downloadable apps) → exact + phonetic variants (`Dwela`, `Dwellar`, `Dwell`, `Dwellah`).
  3. Repeat for `IC 036` (financial/real estate services).
- **Evidence:** Basic search supports URL-shareable query strings in the new system; capture as text + screenshot.

### EU — EUIPO eSearch plus

`[VERIFIED: euipo.europa.eu/eSearch/ 2026-04-05]`

- **URL:** `https://www.euipo.europa.eu/eSearch/` (trailing slash, `www` preferred).
- **Status:** Live. Database has 1.3M+ EUTMs.
- **Search strategy:** Advanced search → search type "Word" → term "Dwella" → Nice class filter `09` and `36`. Repeat with phonetic variants.
- **Evidence:** Results page has a permalink; capture URL + screenshot.

### India — IP India Trade Mark Public Search

`[VERIFIED: tmrsearch.ipindia.gov.in 2026-04-05]`

- **Canonical URL:** `https://tmrsearch.ipindia.gov.in/tmrpublicsearch/frmmain.aspx` (note: CONTEXT.md D-02 says `/eregister/` which is a different — e-register — service; public search lives at `/tmrpublicsearch/frmmain.aspx`).
- **Alternate entry:** `https://tmrsearch.ipindia.gov.in/ESEARCH` (newer front-end, same underlying database).
- **Search strategy:** Wordmark search type → "Dwella" → Class 9, Class 36. Indian portal supports only one class per query so run twice per variant.
- **Gotcha:** Portal requires CAPTCHA on every query, often has downtime during Indian business hours. Budget 30 minutes for this jurisdiction alone.
- **Evidence:** No permalinks — screenshot the results page with visible timestamp.

### Nice Classification Reference

- **Class 9:** Computer software, downloadable mobile applications, software platforms. **This is the primary Dwella class.** `[CITED: WIPO Nice Classification 12th edition]`
- **Class 36:** Real estate affairs, financial affairs including rent collection, property management services. **Secondary Dwella class** because the product helps with rent tracking even though it's not a payment processor.
- **Class 42:** SaaS, platform-as-a-service. Consider adding as tertiary — some jurisdictions classify B2C mobile apps here.

`[ASSUMED]` Whether Class 42 should be added. Planner should include a "check Class 42 if time permits" note but not block the phase on it.

## Cookie/Tracker Static Audit (D-23 expanded)

### Project's Actual File Surface

`[VERIFIED: filesystem scan 2026-04-05]`

- `package.json` — present at repo root ✓
- `app.json` — present at repo root ✓
- `ios/` — **DOES NOT EXIST** on main. No `ios/Podfile.lock` to grep.
- `android/` — **EXISTS**. Contains `android/app/build.gradle`, `android/build.gradle`, `android/settings.gradle`, `android/gradle.properties`. This is Expo prebuild output committed to the repo (not pure managed workflow).

**Static-grep targets for Phase 1:**

```bash
grep -iE 'sentry|posthog|amplitude|mixpanel|segment|firebase-analytics|google-analytics|@?branch|adjust|appsflyer|singular|kochava|fbsdk|facebook-sdk|rudderstack|statsig|launchdarkly|customerio|heap|hotjar|fullstory|intercom|smartlook' package.json app.json android/app/build.gradle android/build.gradle
```

### Expanded SDK List (supplements D-23)

D-23's list is missing several trackers that became common in 2024-2026. Full list for the grep:

**Observability/analytics:**
- `sentry`, `@sentry/*`
- `posthog`, `posthog-react-native`
- `amplitude`, `@amplitude/*`
- `mixpanel`, `mixpanel-react-native`
- `segment`, `@segment/*`
- `rudderstack`, `@rudderstack/*` *(new since D-23)*
- `heap`, `heap-react-native` *(new since D-23)*
- `statsig` *(new since D-23)*
- `launchdarkly` *(flags, but sends PII telemetry — include)*
- `customerio`, `customer.io` *(new since D-23)*
- `hotjar`, `fullstory`, `smartlook`, `logrocket` *(session replay — extremely PII-sensitive)*
- `intercom`, `zendesk` *(chat widgets that fingerprint)*

**Attribution:**
- `branch`, `branch-sdk`
- `adjust`
- `appsflyer`
- `singular`
- `kochava`

**Ad networks:**
- `admob`, `google-mobile-ads`
- `facebook`, `react-native-fbsdk`, `fbsdk`
- `applovin`
- `unity-ads`

**Firebase (subset concerning):**
- `firebase-analytics`
- `@react-native-firebase/analytics`
- `@react-native-firebase/perf`
- `@react-native-firebase/crashlytics`

### Expected Result (based on memory + package.json inspection)

`[VERIFIED: package.json scan 2026-04-05]` — None of the above SDK names appear in Dwella's `package.json`. Sentry was removed, PostHog was removed, no other trackers were added. The static audit should return zero matches. If it does not, escalate immediately.

## Runtime Tracker Capture (D-24 refinement)

### Expo DevTools Network Tab in SDK 54

`[VERIFIED: docs.expo.dev/debugging/tools, 2026-04-05]`

**Access path:**
1. `npx expo start`
2. In the terminal running Expo, press `j` to open React Native DevTools (Chrome DevTools frontend).
3. Switch to the **Network** tab.

**Known limitations:**
- React Native DevTools Network panel records `fetch()`, `XMLHttpRequest`, and `<Image>` requests. It does **NOT** currently record Expo Fetch (custom networking library) — but Dwella uses `@supabase/supabase-js` which wraps stock `fetch`, so all Supabase traffic will appear.
- There are open issues (`expo/expo#35028`, `expo/expo#23633`) about the Network tab being empty in some SDK versions on new projects. SDK 54 status is unclear.
- Fallback: "Expo Network" panel (Expo-branded separate implementation) logs additional request sources with slightly reduced features.

**Export format:** DevTools Network tab supports "Save all as HAR" from the right-click context menu. HAR is JSON and can be grep'd for unique hostnames:

```bash
jq -r '.log.entries[].request.url' dwella-session.har | sed -E 's|https?://([^/]+)/.*|\1|' | sort -u
```

**If DevTools Network tab is broken in SDK 54:** Fall back to **Charles Proxy** (paid, 30-day trial) or **mitmproxy** (free, open source). Configure the device to trust the proxy's CA cert. This is a 1-2 hour setup — a real cost, not a 10-minute task. Planner should budget for either outcome and flag at the scaffold stage.

**Recommendation:** Attempt DevTools first. If empty after a 60-second session, pivot to mitmproxy. Document which tool was used in the attestation.

### Hostname Allowlist (D-25 refinement)

Exact allowlist regex:

```
^(
  [a-z0-9-]+\.supabase\.co|
  [a-z0-9-]+\.supabase\.in|
  api\.telegram\.org|
  api\.anthropic\.com|
  [a-z0-9-]+\.push\.apple\.com|
  fcm\.googleapis\.com|
  [a-z0-9-]+\.expo\.dev|
  [a-z0-9-]+\.expo\.io|
  cdn\.jsdelivr\.net|
  unpkg\.com
)$
```

**Notes:**
- `cdn.jsdelivr.net` and `unpkg.com` added because Expo and some RN libraries fetch font/asset blobs from these during dev. In production build they should not appear — if they do, flag.
- `*.expo.dev` and `*.expo.io` both appear (legacy domains still in use).
- **Any hostname matching `google-analytics.com`, `googletagmanager.com`, `facebook.com`, `fbcdn.net`, `doubleclick.net`, `amplitude.com`, `mixpanel.com`, `segment.io`, `posthog.com`, `sentry.io` → immediate BLOCKER** (indicates a tracker SDK snuck in despite static grep being clean).

## NoBroker Removal (D-07 refinement)

### Current Grep State

`[VERIFIED: filesystem grep 2026-04-05]` — `grep -ri nobroker` returns 10 files:

**Source/code (must be addressed):**
1. `dwella-nobroker-teal.jsx` — repo root, delete whole file (D-06).
2. `constants/colors.ts` — inspect. If the reference is just a comment mentioning the NoBroker teal color, strip the comment. If it's a variable named `nobrokerTeal`, rename and update call sites. **Do not blind-delete this file** — it's a live constants module.

**Planning/docs (expected — these legitimately describe the NoBroker removal work):**
3. `.planning/phases/01-fact-finding-unblockers/01-DISCUSSION-LOG.md`
4. `.planning/phases/01-fact-finding-unblockers/01-CONTEXT.md`
5. `.planning/REQUIREMENTS.md` (IP-02 requirement text)
6. `.planning/ROADMAP.md`
7. `.planning/PROJECT.md`
8. `.planning/codebase/CONCERNS.md`
9. `.planning/codebase/CONVENTIONS.md`
10. `.planning/codebase/STACK.md`

**.gitignore:** also contains a match — benign, probably an ignore pattern. Inspect and keep or strip as appropriate.

**Refined cleanup grep (after planning-docs are excluded):**

```bash
grep -riIE 'nobroker' . \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.planning \
  --exclude='THIRD-PARTY-LICENSES.md'
```

After deletion + `constants/colors.ts` cleanup, this exact command should return **zero matches**. This is the D-07 verification criterion.

The planning-doc matches are documentation of the work and should NOT be scrubbed — they are evidence that the cleanup was performed and would confuse future auditors if retroactively deleted.

## Asset Provenance (D-28 refinement)

### Actual Asset Surface

`[VERIFIED: filesystem scan 2026-04-05]`

- `assets/icon.png` — app icon
- `assets/adaptive-icon.png` — Android adaptive icon foreground
- `assets/splash.png` — splash screen
- `assets/favicon.png` — web favicon
- `assets/images/logo.png` — in-app logo
- `constants/` — no icon/image files (only `.ts` config)

Total: **5 image assets** to enumerate. No embedded fonts (confirmed by `package.json` having no `@expo-google-fonts/*` entries — D-14 is moot and should be struck from the plan).

### C2PA-Based AI Detection (supplements D-29)

`[VERIFIED: c2pa.org FAQ, help.openai.com article 8912793]`

**What C2PA can tell you:**
- ChatGPT/DALL-E images include C2PA metadata by default (as of OpenAI's web + API rollout).
- Adobe Firefly, Google Imagen, and some Midjourney tiers embed C2PA.
- Tooling: `c2patool` CLI from `github.com/contentauth/c2patool` — extracts C2PA assertions from image files.

**What C2PA CANNOT tell you:**
- Whether an image was AI-generated if the metadata was stripped (trivial — one pass through any image editor, any re-save, any upload to most social platforms removes it).
- Images from older Midjourney versions, Stable Diffusion locally run, or any image generated before C2PA adoption.

**Recommended approach for IP-04:**
1. Run `c2patool assets/*.png` as a mechanical check — 5 minutes. If ANY asset returns C2PA assertions, that is definitive proof of origin.
2. Absence of C2PA metadata is NOT proof the asset is not AI-generated.
3. The IP-04 memo must rely primarily on **human recall** from the solo dev — "I made this with X tool on Y date."
4. If human recall is insufficient for any asset → D-30 blocker, escalate.

**Planner action:** Add a single autonomous task to run `npx c2patool assets/icon.png assets/adaptive-icon.png assets/splash.png assets/favicon.png assets/images/logo.png` and append the output to `asset-provenance.md`. This is a 5-minute bonus check, not a substitute for the human memo.

## Common Pitfalls

### Pitfall 1: Assuming Anthropic DPA is Self-Serve
**What goes wrong:** Planner writes a task "download DPA from console.anthropic.com → Settings → Compliance." Executor cannot find any such menu. Phase stalls.
**Why it happens:** CONTEXT.md D-15 is based on a pattern common at AWS/GCP but incorrect for Anthropic.
**How to avoid:** Use the corrected workflow in the Anthropic DPA Reality section above. Evidence is Commercial Terms acceptance, not a signed PDF.
**Warning signs:** Task says "upload signed DPA PDF" or references `anthropic-dpa-signed.pdf`.

### Pitfall 2: USPTO TESS URL Cargo-Cult
**What goes wrong:** Task says "go to TESS, run a search with wildcard syntax `d*wella*`." Executor tries but new search system uses different syntax.
**Why it happens:** TESS retired in Nov 2023 but public blog posts and legal writeups still mention it by name.
**How to avoid:** Phrase the task as "Use the USPTO Trademark Search system (post-TESS) at tmsearch.uspto.gov. Basic search = exact term; advanced search supports Nice class filtering."
**Warning signs:** Task references "TESS syntax" or wildcard patterns.

### Pitfall 3: Blanket NoBroker Scrub Breaks Constants
**What goes wrong:** Task runs `grep -l nobroker | xargs rm` and deletes `constants/colors.ts`, breaking the app.
**Why it happens:** D-07 as written implies "delete every other file that matches" without distinguishing code from docs.
**How to avoid:** Two-step: (1) list all matches, (2) for each match, decide delete vs. edit-in-place vs. leave-as-documentation. See NoBroker Removal section above.
**Warning signs:** Task uses `xargs rm` or `find ... -delete` against grep results.

### Pitfall 4: license-checker-rseidelsohn False Negatives on SPDX Expressions
**What goes wrong:** Package declares `"license": "(MIT OR GPL-3.0)"`. Naive grep for `"GPL"` catches it, but a grep expecting the pattern `"license": "GPL-..."` misses it entirely.
**Why it happens:** SPDX expressions use parentheses and logical operators; packages with a dual-license option are surprisingly common.
**How to avoid:** Use the expression-aware regex in the Detection Patterns section above. Test against the actual output before relying on it.
**Warning signs:** GPL detection returns zero matches against a known-GPL-dependent tree (regression test possible with a deliberately-installed GPL package).

### Pitfall 5: Runtime Capture Ignores Production Bundle Differences
**What goes wrong:** Executor runs `npx expo start` (dev build), captures hostnames, concludes no trackers. Production bundle has different code paths (e.g., production error-reporting block that was dead-code-eliminated in dev).
**Why it happens:** Dwella has conditional code paths based on `__DEV__` or NODE_ENV.
**How to avoid:** Grep the source for `__DEV__`, `process.env.NODE_ENV`, and any conditional imports. Document which code paths are production-only. Ideally, runtime capture should target an EAS production build on device, not a dev build — but that's harder to instrument (requires mitmproxy on device, not DevTools).
**Warning signs:** Attestation says "captured in dev mode" without noting production-only code paths were separately reviewed.

### Pitfall 6: IP India Portal Downtime and CAPTCHAs
**What goes wrong:** Executor tries to batch India searches, hits CAPTCHA wall, gets rate-limited, abandons.
**Why it happens:** The portal is notoriously slow and rejects rapid-fire queries.
**How to avoid:** Budget 30-45 minutes for India alone. Run searches one at a time with ~30s between. Consider running during off-peak hours (outside India business hours).
**Warning signs:** Task estimates "15 minutes for trademark searches across all 3 jurisdictions."

## Code Examples

### license-checker Full Invocation

```bash
# Run
npx license-checker-rseidelsohn --production --json --out .planning/legal/npm-licenses.json

# Verify no GPL family
if grep -iE '"(licenses?|license)": *"[^"]*\b(A?GPL|LGPL|SSPL)[^"]*"' .planning/legal/npm-licenses.json; then
  echo "BLOCKER: copyleft license detected"
  exit 1
fi

# Summary by license for the markdown file
jq -r 'to_entries | map({key: .key, licenses: .value.licenses}) | group_by(.licenses) | map({license: .[0].licenses, packages: map(.key)}) | .[] | "### \(.license)\n" + (.packages | map("- \(.)") | join("\n"))' .planning/legal/npm-licenses.json
```

### NoBroker Final Verification

```bash
# After deletion + constants cleanup
matches=$(grep -riIE 'nobroker' . \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.planning \
  --exclude='THIRD-PARTY-LICENSES.md' \
  | wc -l)

if [ "$matches" -ne 0 ]; then
  echo "BLOCKER: $matches nobroker references still in working tree"
  grep -riIE 'nobroker' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.planning
  exit 1
fi
echo "OK: zero NoBroker references in code"
```

### HAR Hostname Extraction

```bash
# After exporting dwella-session.har from React Native DevTools Network tab
jq -r '.log.entries[].request.url' dwella-session.har \
  | awk -F[/:] '{print $4}' \
  | sort -u \
  | tee .planning/legal/runtime-hostnames.txt
```

### c2patool AI Metadata Check

```bash
npx c2patool assets/icon.png 2>&1 | tee -a .planning/legal/asset-provenance.md
# Repeat for adaptive-icon.png, splash.png, favicon.png, images/logo.png
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| USPTO TESS wildcard search | New cloud Trademark Search with SPDX-like syntax | 2023-11-30 | D-02 URL is stale; new query syntax |
| Anthropic DPA via email request | Incorporation by reference via Commercial Terms | Ongoing — no countersigning workflow ever existed in console | D-15/D-16 workflow doesn't exist as written |
| `davglass/license-checker` (abandoned) | `license-checker-rseidelsohn` (maintained fork) | 2022 | D-10 already uses correct tool |
| Chrome `remote-debug` network tab in RN | React Native DevTools (first-party, `j` keybind) | RN 0.76+ / Expo SDK 52+ | D-24 DevTools path is correct for SDK 54 |
| Sentry native plugin | — (removed from Dwella entirely, not re-added in Phase 1) | 2026-Q1 removal from project | Phase 1 only confirms absence; re-enablement is SEC-04 in Phase 3 |

**Deprecated/outdated:**
- TESS (USPTO): replaced 2023-11-30, retained URL redirects to new system.
- `davglass/license-checker`: unmaintained since ~2021, superseded by `license-checker-rseidelsohn`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `license-checker-rseidelsohn` JSON output uses lowercase `licenses` key | Detection Patterns | Grep misses GPL packages — HIGH risk. Mitigate with pilot run task. |
| A2 | Plain markdown is preferred format for THIRD-PARTY-LICENSES.md over SBOM/SPDX JSON | THIRD-PARTY-LICENSES Format | LOW — worst case is refactor to SBOM later |
| A3 | Nice Class 42 (SaaS) is optional rather than required for Dwella trademark search | Trademark Search URLs | MEDIUM — could miss a conflict in a class not searched. Recommend including as a stretch goal. |
| A4 | React Native DevTools Network tab will actually work in Expo SDK 54 for Dwella | Runtime Tracker Capture | MEDIUM — known open issues; mitigation is mitmproxy fallback documented |
| A5 | The `sharp` optional dependency does not ship in the production bundle | license-checker section | LOW — if wrong, sharp is Apache-2.0, no legal impact |
| A6 | USPTO new search system still supports Nice class filtering in advanced mode | Trademark search strategy | LOW — verified advanced interface exists, exact filter UI not probed this session |
| A7 | `.gitignore` containing a `nobroker` pattern is benign and safe to leave | NoBroker Removal | LOW — even if retained, the pattern is historical and doesn't affect build |
| A8 | Anthropic does not accept custom DPA requests for solo-dev API accounts | Anthropic DPA Reality | LOW — CONTEXT.md D-18 already rules out custom DPAs |
| A9 | All of Dwella's 5 image assets are static PNGs (no embedded fonts, no SVGs requiring separate license audit) | Asset Provenance | VERIFIED from filesystem — no risk |
| A10 | No `@expo-google-fonts/*` or other font packages are in `package.json` so SIL OFL attestation (D-14) is moot | Summary / license section | VERIFIED — no risk |

**User-confirmation recommended for:** A1 (run license-checker once to verify JSON shape before writing the grep into a task), A3 (decide whether Class 42 is in scope for India/EU/US searches), A4 (ask user if they have mitmproxy already installed or whether DevTools-first is acceptable).

## Open Questions

1. **Does the Dwella account on console.anthropic.com have Commercial Terms acceptance recorded?**
   - What we know: Any API-key-using account must be on Commercial Terms (consumer claude.ai is separate).
   - What's unclear: Whether the account page surfaces a visible "accepted on {date}" timestamp.
   - Recommendation: Scaffold `dpa-register.md` with a placeholder; verify task asserts the date field is populated.

2. **Is there an EAS production build available for a true production-mode runtime capture?**
   - What we know: OPS-03 in Phase 7 says EAS production build is part of final verification.
   - What's unclear: Whether a recent production build exists today or only dev builds are available in Phase 1.
   - Recommendation: Phase 1 runtime capture proceeds on dev build with a caveat in the attestation. Phase 7 smoke test re-captures on production build; any new hostnames there are a Phase 7 blocker.

3. **Is Class 42 (SaaS) in scope for the trademark search?**
   - What we know: Dwella is a mobile app (Class 9) and deals with rent tracking (Class 36). It's not traditionally SaaS.
   - What's unclear: Whether Indian/EU examiners might classify a backend-hosted mobile app under Class 42 as well.
   - Recommendation: Run Class 42 searches as a "if time permits" bonus after Classes 9 and 36 are clear. Don't block the phase on it.

4. **Does `.gitignore` actually contain the string `nobroker`, or is the grep hit a false positive from ripgrep's binary-detection heuristics?**
   - What we know: `grep -ri nobroker` returned `.gitignore` as a hit in the current tree.
   - What's unclear: What the matching line contains (probably `dwella-nobroker-teal.jsx` added to ignore list at some point).
   - Recommendation: Autonomous task reads the line, strips if it's only a filename reference to the now-deleted file.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `npx` / npm | license-checker-rseidelsohn run | ✓ | ships with Node | — |
| `grep` (POSIX) | Static audits, NoBroker sweep, GPL detection | ✓ | system | — |
| `jq` | JSON parsing of license output + HAR files | ? | not verified | `grep -E` (less robust but works) |
| Web browser | USPTO / EUIPO / IP India portals, Supabase dashboard, Anthropic console | ✓ (human) | — | — |
| React Native DevTools | Runtime tracker capture (D-24) | ✓ | ships with Expo SDK 54 | mitmproxy |
| `c2patool` | Optional AI-image provenance check | via `npx` | latest | skip (human memory only) |
| `mitmproxy` or Charles Proxy | Runtime capture fallback if DevTools Network tab is broken | ? | — | Degraded attestation (static grep only) |
| Expo dev server (`expo start`) | Runtime capture | ✓ | `expo ~54.0.0` | — |
| Supabase dashboard account | COMP-05 region lookup | ✓ (human) | — | — |
| Anthropic console account | COMP-06 evidence | ✓ (human) | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- `jq`: may not be installed. Fallback regex is usable but brittle. Recommendation: task includes `npx jq` via `node-jq` or installs via winget/apt. On Windows (user's platform), `winget install stedolan.jq` installs it.
- `mitmproxy`/Charles: not installed by default. Only needed if DevTools fails. Fallback is a static-grep-only attestation with a documented caveat.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None (per `.planning/codebase/TESTING.md` — zero automated tests in project) |
| Config file | — |
| Quick run command | `bash .planning/phases/01-fact-finding-unblockers/verify.sh` (to be created in Wave 0) |
| Full suite command | same |

**Note:** Phase 1 is a fact-finding phase — validation is shell-based assertions over filesystem + grep + HTTP checks, not unit tests. The "test framework" is a single bash verification script that each verify-task appends to.

### Phase Requirements → Verification Map (per locked decision)

Every D-* decision must have an automated or semi-automated verification. Non-autonomous steps verify the **artifact** the human produced, not the act itself.

| Decision | Verification Command | Automated? | What It Proves |
|----------|---------------------|-----------|----------------|
| D-01 | `test -f .planning/legal/trademark-clearance-dwella.md` | ✓ | Memo file exists |
| D-02 | `grep -E '(tmsearch\.uspto\.gov\|euipo\.europa\.eu/eSearch\|tmrsearch\.ipindia\.gov\.in)' .planning/legal/trademark-clearance-dwella.md \| wc -l` returns `>= 3` | ✓ | All 3 jurisdiction URLs cited |
| D-03 | `grep -c '^### ' .planning/legal/trademark-clearance-dwella.md` returns `>= 3` (one section per jurisdiction) AND `grep -iE 'conclusion:' returns >= 3` | ✓ | Memo is structured with per-jurisdiction sections and conclusions |
| D-04 | `grep -iE '(exact conflict\|STOP)' .planning/legal/trademark-clearance-dwella.md \|\| echo "no conflicts flagged"` — human-reviewed | semi | Blocker flagging pattern followed |
| D-05 | (non-verifiable — deferral statement in doc) | — | — |
| D-06 | `test ! -f dwella-nobroker-teal.jsx` | ✓ | File deleted |
| D-07 | `grep -riIE 'nobroker' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.planning --exclude=THIRD-PARTY-LICENSES.md \| wc -l` returns `0` | ✓ | Zero NoBroker refs in code |
| D-08 | `git log --all --oneline \| head -1` (sanity — should not be a force-pushed orphan) | ✓ | History not rewritten |
| D-09 | `basename $(pwd)` returns `Dwella v2` | ✓ | Repo not renamed |
| D-10 | `test -f .planning/legal/npm-licenses.json && jq '. \| length' .planning/legal/npm-licenses.json` returns `>= 1` | ✓ | License JSON exists and has entries |
| D-11 | `! grep -iE '"licenses?": *"[^"]*\b(A?GPL\|LGPL\|SSPL)[^"]*"' .planning/legal/npm-licenses.json` (zero matches = pass) | ✓ | No copyleft detected |
| D-12 | `test -f .planning/legal/asset-provenance.md && grep -c '^## ' .planning/legal/asset-provenance.md` returns `>= 5` (one section per asset) | ✓ | All 5 assets enumerated |
| D-13 | `test -f THIRD-PARTY-LICENSES.md && grep -iE 'no (GPL\|AGPL)' THIRD-PARTY-LICENSES.md` returns `>= 1` | ✓ | Attestation file exists with non-contamination statement |
| D-14 | `grep -c '@expo-google-fonts' package.json` returns `0` → decision is MOOT, remove from plan | ✓ | N/A — verified moot |
| D-15 | (CORRECTED) `test -f .planning/legal/anthropic-dpa-public-*.pdf` | ✓ | Public DPA PDF archived |
| D-16 | (CORRECTED) `grep -iE 'Commercial Terms accepted on [0-9]' .planning/legal/dpa-register.md` | ✓ | Register records Commercial Terms date |
| D-17 | `curl -sI https://supabase.com/legal/dpa \| head -1 \| grep -E '200\|301'` AND `grep -c 'supabase\.com/legal/dpa' .planning/legal/dpa-register.md` returns `>= 1` | ✓ | URL live + recorded |
| D-18 | (documented in register, non-verifiable beyond file presence) | — | — |
| D-19 | `grep -iE 'region: *(us\|eu\|ap\|sa)-[a-z]+-[0-9]+' .planning/legal/cross-border-transfers.md` | ✓ | Region string matches AWS region format |
| D-20 | `grep -iE '^## Infrastructure' .planning/PROJECT.md` AND `grep -iE 'supabase.*region' .planning/PROJECT.md` | ✓ | PROJECT.md updated with infra section |
| D-21 | `grep -cE 'GDPR\|DPDP\|SCC' .planning/legal/cross-border-transfers.md` returns `>= 3` | ✓ | Memo covers all 3 legal regimes |
| D-22 | (Phase 2 consumes this — no Phase 1 verification) | — | — |
| D-23 | `! grep -iE 'sentry\|posthog\|amplitude\|mixpanel\|segment\|firebase-analytics\|branch\|adjust\|appsflyer\|rudderstack\|heap\|statsig\|customerio\|fullstory\|hotjar' package.json app.json android/app/build.gradle 2>/dev/null` (zero matches = pass) | ✓ | Static grep clean |
| D-24 | `test -f .planning/legal/runtime-hostnames.txt && wc -l < .planning/legal/runtime-hostnames.txt` returns `>= 1` | ✓ | Runtime capture performed |
| D-25 | `grep -vE '^(.*\.supabase\.(co\|in)\|api\.telegram\.org\|api\.anthropic\.com\|.*\.push\.apple\.com\|fcm\.googleapis\.com\|.*\.expo\.(dev\|io))$' .planning/legal/runtime-hostnames.txt` returns ZERO lines | ✓ | Every observed hostname matches allowlist |
| D-26 | `test -f .planning/legal/tracker-audit.md && grep -iE 'no (third-party analytics\|silent trackers\|ad SDK)' .planning/legal/tracker-audit.md` | ✓ | Attestation statement present |
| D-27 | (statement of intent — non-verifiable) | — | — |
| D-28 | `grep -cE '(creator:\|tool:\|license:\|date:)' .planning/legal/asset-provenance.md` returns `>= 20` (4 fields × 5 assets) | ✓ | Every asset has all 4 metadata fields |
| D-29 | For AI-generated assets: `grep -iE '(midjourney\|dall-e\|stable.diffusion\|ideogram\|firefly)' .planning/legal/asset-provenance.md` and if any match, `grep -iE 'commercial.use.*(granted\|confirmed)'` must also match | semi | AI assets flagged with commercial rights check |
| D-30 | `! grep -iE '(unknown\|unrecoverable\|BLOCKER)' .planning/legal/asset-provenance.md` (zero matches = pass) | ✓ | No unresolved provenance |
| D-31 | `test -f .planning/legal/asset-provenance.md` | ✓ | Output file exists |

### Sampling Rate
- **Per task commit:** Run the specific verify command for the decision the task addresses.
- **Per wave merge:** Run all D-* verification commands together (~30 seconds total since they're all file + grep checks).
- **Phase gate:** Full verification suite green + Phase 1 requirement checkboxes flipped in `.planning/REQUIREMENTS.md` before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `.planning/phases/01-fact-finding-unblockers/verify.sh` — single shell script containing all 25+ D-* verification commands, exits non-zero on any failure. Planner should include this as the first task in the first wave.
- [ ] `.planning/legal/` directory — create if not present (mkdir task).
- [ ] Install `jq` if missing on Windows: `winget install stedolan.jq` (optional but makes several checks cleaner).
- [ ] No test framework install needed — phase uses bash + grep only.

## Security Domain

Phase 1 is a fact-finding phase that writes legal documents and deletes one file. It does **not** add new code paths, authentication, session management, or crypto. ASVS categories apply minimally:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (minor) | When shelling out to grep/license-checker with user-provided paths, always quote arguments and use `--` separators |
| V6 Cryptography | no | — |
| V7 Error Handling | yes (minor) | Verification scripts must exit non-zero on failure and log which check failed |
| V14 Configuration | yes | Delete of `dwella-nobroker-teal.jsx` must not accidentally touch `.env`, `constants/config.ts`, or any secrets-bearing file |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Accidental deletion of live code during NoBroker sweep | Tampering | Two-step: list matches → human/rule review per match → delete. Never `xargs rm` against grep results. |
| Exfiltration of credentials via license-checker output (packages with exposed `.npmrc` tokens in their `package.json`) | Information disclosure | `--production --json` output is safe; packages' `author.email` and repo URLs are non-secret. No mitigation needed. |
| Committing downloaded DPA PDFs that contain account-identifying metadata | Information disclosure | `pdftk` or `qpdf` can strip metadata; alternatively, download the public DPA (no account metadata) vs. any signed/account-specific copy. Recommend the public version for the archive. |

## Project Constraints (from CLAUDE.md)

- **Commit discipline:** Every meaningful unit of work is committed and pushed immediately. Phase 1 should produce ~10-15 commits (one per decision closeout or file creation), not one mega-commit.
- **Commit message format:** `type: summary` (feat/fix/refactor/chore/style/docs). Phase 1 is almost entirely `docs:` and `chore:`.
  - `docs: add trademark clearance memo for India/EU/US`
  - `chore: remove dwella-nobroker-teal.jsx`
  - `docs: record Supabase region and cross-border analysis`
- **One logical change per commit** — do not batch "delete NoBroker + record Supabase region" in one commit.
- **Co-Authored-By trailer** required on every commit.
- **Never force-push main.**
- **No new product features** (explicit project scope freeze for v1.0 launch prep). Phase 1 complies — only legal docs + one file deletion.

## Sources

### Primary (HIGH confidence)
- `https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa` — fetched via WebFetch 2026-04-05 — authoritative for Anthropic DPA workflow (confirms DPA is by incorporation, not download).
- `https://www.uspto.gov/subscription-center/2023/retiring-tess-what-know-about-new-trademark-search-system` — TESS retirement authoritative notice.
- `https://supabase.com/legal/dpa` + `https://supabase.com/downloads/docs/Supabase+DPA+260317.pdf` — Supabase DPA canonical location + latest version date.
- `https://www.npmjs.com/package/license-checker-rseidelsohn` — license-checker flags and JSON output shape.
- `https://docs.expo.dev/debugging/tools/` — React Native DevTools access in Expo SDK 54.
- `https://euipo.europa.eu/eSearch/` — EUIPO eSearch plus (direct verification).
- `https://tmrsearch.ipindia.gov.in/tmrpublicsearch/frmmain.aspx` — IP India public search (corrected URL vs. CONTEXT.md).
- Filesystem scan of `C:/Users/Spongeass/Desktop/Claude Code/Dwella v2` 2026-04-05 — `package.json`, `android/`, `assets/`, NoBroker grep hits, asset enumeration.
- `https://c2pa.org/faqs/` + `https://help.openai.com/en/articles/8912793-c2pa-in-chatgpt-images` — C2PA metadata semantics.

### Secondary (MEDIUM confidence)
- `https://www.altlegal.com/blog/about-the-usptos-new-trademark-search-system/` — TESS replacement details (commercial blog, cross-referenced with USPTO primary).
- `https://github.com/RSeidelsohn/license-checker-rseidelsohn/issues/36` — workspaces gotcha (not applicable to Dwella but good to know).

### Tertiary (LOW confidence)
- None — all claims in this research cite either primary sources or direct filesystem verification.

## Metadata

**Confidence breakdown:**
- Standard stack (tools): HIGH — every tool verified against primary docs or tested locally.
- Architecture (scaffold/verify pattern): HIGH — standard GSD idiom.
- Pitfalls: HIGH — four of six come from direct filesystem observation of Dwella's actual state.
- Anthropic DPA correction: HIGH — verified via primary Anthropic privacy center article.
- USPTO TESS correction: HIGH — verified via official USPTO retirement notice.

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (30 days — portal URLs and DPA versions can drift, re-verify before Phase 2 drafting begins)
