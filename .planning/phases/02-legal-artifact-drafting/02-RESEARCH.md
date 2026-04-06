# Phase 2: Legal Artifact Drafting - Research

**Researched:** 2026-04-06
**Domain:** Privacy law compliance (GDPR/DPDP/CCPA), legal document drafting, static site hosting
**Confidence:** HIGH

## Summary

Phase 2 produces three deliverables: (1) a Privacy Policy compliant with GDPR Articles 13/14, DPDP Act 2023 Section 5, and CCPA/CPRA, (2) a Terms of Service / EULA covering dual-role users with record-keeper disclaimers, and (3) a GitHub Pages hosting setup to publish both at stable URLs. All upstream data (sub-processor list, cross-border transfers, Supabase region, tracker audit) was gathered in Phase 1 and is ready to be transcribed into legal language.

The documents are pure Markdown/HTML files hosted on GitHub Pages. No code changes to the app are needed in this phase --- in-app links and consent flows are Phase 5, store submissions are Phase 6. The solo developer is the data controller (natural person), governing law is India, and the privacy policy must enumerate 7 data categories with specific retention periods.

**Primary recommendation:** Draft documents as Markdown files in a `docs/legal/` directory, deploy via GitHub Pages from the `/docs` folder on `main` branch, and structure the privacy policy with a GDPR-complete baseline plus clearly marked DPDP and CCPA jurisdiction sections.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Host on GitHub Pages from existing repo (`hruaia21hrahsel.github.io/Dwella-v2/`), `docs/legal/` subfolder. Free, stable, no additional infrastructure.
- **D-02:** URL format: `https://hruaia21hrahsel.github.io/Dwella-v2/privacy-policy` and `.../terms-of-service`. Stability critical --- do not change after this phase.
- **D-03:** If GitHub Pages rejected later, URL can be redirected, but all downstream references depend on the URL chosen here.
- **D-04:** Single document per artifact with jurisdiction-specific sections layered in --- NOT separate per-jurisdiction documents.
- **D-05:** Privacy Policy structure: GDPR Articles 13/14 baseline with marked `### For users in India (DPDP Act 2023)` and `### For users in California (CCPA/CPRA)` sections.
- **D-06:** ToS: universal terms, both roles, record-keeper disclaimer (not payment processor, escrow, or legal advisor).
- **D-07:** 7 data categories each with purpose, legal basis, retention: (1) Account/identity, (2) Property, (3) Tenant, (4) Payment/financial, (5) Bot conversations, (6) Notifications, (7) Push tokens.
- **D-08:** Retention periods defined in this phase: account 30d post-deletion, property/tenant 30d post-archival, payments 7y (Indian Income Tax Act), bot logs 90d rolling, notifications 90d, push tokens until logout/deletion.
- **D-09:** Sub-processor list matches `dpa-register.md` exactly: Supabase (ap-northeast-1), Anthropic (US), Telegram (global), Expo Push (US).
- **D-10:** Each processor: name, country, purpose, data categories, legal basis, DPA reference.
- **D-11:** Cross-border disclosure per `cross-border-transfers.md`: Japan (adequacy + SCCs), US (SCCs), Telegram (user-initiated).
- **D-12:** Data controller is solo individual developer (natural person, not entity). Names natural person + contact email.
- **D-13:** Governing law: India (developer residence, Aizawl, Mizoram).
- **D-14:** DPDP grievance officer: developer's email (updatable later).
- **D-15:** CCPA "Do Not Sell or Share" section required even though no selling occurs. Affirmative disclosure.
- **D-16:** No interactive opt-out mechanism at v1.0 (no selling/sharing). Simple disclosure suffices.
- **D-17:** ToS forward-looking paid-features clause. General, covers subscription/one-time/freemium without specifics.
- **D-18:** No actual IAP terms at v1.0 --- placeholder clause only.

### Claude's Discretion
- Exact legal language and clause wording
- Document formatting (Markdown vs HTML rendering)
- Table of contents in long documents
- Cookie policy handling ("we don't use cookies" statement)
- Version numbering scheme (e.g., "v1.0, effective 2026-XX-XX")

### Deferred Ideas (OUT OF SCOPE)
- Cookie consent banner (zero cookies/trackers)
- In-app acceptance UI (Phase 5, LEGAL-05)
- AI consent gate (Phase 5, LEGAL-06)
- Account deletion flow (Phase 4, COMP-01)
- Data export/portability (Phase 4, COMP-04)
- Store privacy labels (Phase 6)
- Legal entity formation (FUT-05)
- Multi-language translations (FUT-06)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LEGAL-01 | Privacy Policy exists, GDPR Art 13/14 compliant, DPDP notice, CCPA disclosures, stable URL | GDPR Art 13 checklist (12 mandatory items), DPDP S5 requirements, GitHub Pages hosting pattern |
| LEGAL-02 | Privacy Policy discloses every data flow (Supabase, Anthropic, Telegram, Expo) with purpose, legal basis, retention | Sub-processor table from dpa-register.md, cross-border analysis, data categories from lib/types.ts |
| LEGAL-03 | ToS/EULA covers both roles, record-keeper disclaimer, governing law | Dual-role system architecture, India governing law, disclaimer language patterns |
| LEGAL-04 | ToS forward-looking paid-features clause | Monetization clause pattern (broad reservation of rights) |
| COMP-08 | CCPA "Do Not Sell or Share" link/section present | CCPA affirmative disclosure requirement (even when no selling occurs) |
| COMP-09 | DPDP grievance officer contact in privacy policy | DPDP Act 2023 S5 notice requirements (grievance officer + complaint to Board) |
</phase_requirements>

## Standard Stack

This phase produces legal documents, not application code. The "stack" is the hosting and formatting toolchain.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| GitHub Pages | N/A (GitHub service) | Static hosting for legal docs | Free, stable URLs, already have the repo [VERIFIED: GitHub docs] |
| Markdown | N/A | Document authoring format | GitHub Pages renders `.md` natively, easy to maintain [VERIFIED: GitHub docs] |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| Jekyll (built into GitHub Pages) | Markdown-to-HTML rendering | Automatic --- GitHub Pages uses Jekyll by default for `.md` files [VERIFIED: GitHub docs] |
| HTML (optional) | Custom-styled legal pages | Only if Markdown rendering is insufficient for formatting needs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GitHub Pages | Supabase Edge Function serving HTML | More infrastructure to maintain, but would allow custom domain more easily |
| Markdown | Plain HTML files | More control over styling but harder to maintain/edit |

## Architecture Patterns

### Recommended Project Structure
```
docs/
└── legal/
    ├── index.html           # Optional: redirect to privacy policy
    ├── privacy-policy.md    # GDPR/DPDP/CCPA privacy policy
    └── terms-of-service.md  # ToS / EULA
```

**Why `docs/legal/`:** GitHub Pages supports publishing from `/docs` folder on a branch. The repo settings point to `docs/` as the source. Legal docs live in `docs/legal/` subfolder. URLs resolve as:
- `https://hruaia21hrahsel.github.io/Dwella-v2/legal/privacy-policy` (if using pretty permalinks)
- `https://hruaia21hrahsel.github.io/Dwella-v2/legal/privacy-policy.html` (default Jekyll)

**Important URL consideration:** The CONTEXT.md decision D-02 specifies URLs without `/legal/` in the path (e.g., `.../privacy-policy`). To achieve this, the files should be placed at `docs/privacy-policy.md` and `docs/terms-of-service.md` directly, OR a Jekyll permalink front matter should be used in `docs/legal/privacy-policy.md` to override the URL path. [ASSUMED]

### Pattern 1: GitHub Pages from /docs folder
**What:** Configure repo Settings > Pages > Source to "Deploy from branch" with folder `/docs`
**When to use:** Always for this phase
**Steps:**
1. Create `docs/` directory in repo root
2. Add legal document Markdown files
3. Go to GitHub repo Settings > Pages
4. Set source: branch `main`, folder `/docs`
5. Save --- site publishes at `https://hruaia21hrahsel.github.io/Dwella-v2/`

### Pattern 2: GDPR Art 13/14 Baseline Privacy Policy Structure
**What:** Organize the privacy policy to cover all 12 mandatory GDPR Article 13 information items
**Source:** [GDPR Article 13 text](https://gdpr-info.eu/art-13-gdpr/)

Required sections (in order):
1. **Data Controller Identity** --- name, contact details (Art 13(1)(a))
2. **Data Protection Officer** --- "not applicable" for solo dev under threshold (Art 13(1)(b))
3. **Purposes and Legal Basis** --- per data category (Art 13(1)(c))
4. **Legitimate Interests** --- where Art 6(1)(f) is relied upon (Art 13(1)(d))
5. **Recipients / Sub-processors** --- 4 processors with full details (Art 13(1)(e))
6. **Cross-border Transfers** --- Japan, US, safeguards (Art 13(1)(f))
7. **Retention Periods** --- per data category (Art 13(2)(a))
8. **Data Subject Rights** --- access, rectification, erasure, restriction, portability, objection (Art 13(2)(b))
9. **Right to Withdraw Consent** --- for consent-based processing like AI features (Art 13(2)(c))
10. **Right to Complain** --- to supervisory authority (Art 13(2)(d))
11. **Contractual/Statutory Requirement** --- whether data provision is required (Art 13(2)(e))
12. **Automated Decision-Making** --- AI bot does not make automated decisions with legal effect; disclose what it does (Art 13(2)(f))

### Pattern 3: Jurisdiction-Specific Layering
**What:** After the GDPR baseline, add clearly marked sections for DPDP and CCPA
**Structure:**
```markdown
## For Users in India (DPDP Act 2023)
- Grievance officer contact (COMP-09)
- Right to complain to Data Protection Board of India
- Cross-border transfer under S16 default permissive regime

## For Users in California (CCPA/CPRA)
- "Do Not Sell or Share" affirmative disclosure (COMP-08)
- Categories of PI collected in last 12 months
- Consumer rights under CCPA
```

### Anti-Patterns to Avoid
- **Separate documents per jurisdiction:** Creates maintenance burden and risks inconsistency. Use one document with layered sections (locked decision D-04).
- **Vague retention periods:** "We retain data as long as necessary" is NOT GDPR-compliant. Art 13(2)(a) requires specific periods or criteria. D-08 defines exact periods.
- **Missing sub-processor details:** Listing "third-party services" without names, countries, and purposes violates Art 13(1)(e). D-09/D-10 require full details.
- **Claiming DPO when none exists:** Solo developers under the GDPR DPO threshold should NOT claim to have a DPO. State "not applicable" or omit. [ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hosting legal docs | Custom server / Edge Function | GitHub Pages (free, stable) | Zero maintenance, built into GitHub, stable URLs |
| Legal clause language | Writing from scratch | GDPR Art 13 structure + templates from regulatory sources | Regulatory text defines required content; freelancing risks omissions |
| Markdown rendering | Custom build pipeline | Jekyll (built into GitHub Pages) | Automatic, no config needed for basic rendering |

## Common Pitfalls

### Pitfall 1: GitHub Pages URL structure mismatch
**What goes wrong:** Files placed at `docs/legal/privacy-policy.md` render at `.../legal/privacy-policy` but D-02 expects `.../privacy-policy` (no `/legal/` segment).
**Why it happens:** GitHub Pages mirrors the folder structure as URL paths.
**How to avoid:** Either place files directly in `docs/` (no `legal/` subfolder), OR use Jekyll front matter with `permalink: /privacy-policy` to override the URL path. Verify the actual rendered URL before committing to it in downstream references.
**Warning signs:** 404 errors when navigating to the expected URL.

### Pitfall 2: Missing GDPR mandatory fields
**What goes wrong:** Privacy policy omits one of the 12 Art 13 mandatory items, making it technically non-compliant.
**Why it happens:** Common omissions: right to lodge complaint with supervisory authority, whether data provision is statutory/contractual requirement, automated decision-making disclosure.
**How to avoid:** Use the 12-item checklist from this research as a verification gate. Check every item off before publishing.
**Warning signs:** Any section header from the Art 13 list that has no content.

### Pitfall 3: Incorrect "Do Not Sell" framing
**What goes wrong:** Including CCPA opt-out mechanism or interactive form when no selling/sharing occurs, creating unnecessary complexity.
**Why it happens:** Over-reading CCPA requirements. If no selling/sharing occurs, the requirement is affirmative disclosure only.
**How to avoid:** D-15/D-16 are clear: simple disclosure section stating "Dwella does not sell or share personal information." No interactive form needed at v1.0.
**Warning signs:** Building opt-out toggle infrastructure for a non-existent data practice.

### Pitfall 4: Soft-delete not disclosed
**What goes wrong:** Privacy policy says "we delete your data" but the app actually sets `is_archived = TRUE` (soft-delete).
**Why it happens:** The app's deletion pattern is soft-delete by default. Hard-delete is implemented in Phase 4.
**How to avoid:** Privacy policy must honestly disclose: "When you delete content, it is initially archived and retained for [30 days] before permanent deletion. You may request immediate permanent deletion via [contact method]." Phase 4 implements the actual hard-delete flow.
**Warning signs:** Claiming immediate deletion when the code does `is_archived = TRUE`.

### Pitfall 5: Bot data flow not gated in disclosure
**What goes wrong:** Privacy policy implies all users' data goes to Anthropic/Telegram when only bot-using users' data does.
**Why it happens:** Not distinguishing between data flows that happen for all users vs. consent-gated flows.
**How to avoid:** Sub-processor entries for Anthropic and Telegram must note: "Only for users who opt into AI features" (Anthropic) and "Only for users who link a Telegram chat" (Telegram). Cross-reference COMP-07 and LEGAL-06.
**Warning signs:** Privacy policy that lists Anthropic as receiving "all user data."

### Pitfall 6: Indian Income Tax Act retention claim without citation
**What goes wrong:** Claiming 7-year retention for payment data "because Indian tax law requires it" without citing the specific provision.
**Why it happens:** The 7-year period is commonly cited but the specific section is often omitted.
**How to avoid:** Cite Section 44AA of the Indian Income Tax Act, 1961 (books of account maintenance for 6 years from end of relevant assessment year, rounded to 7 for safety) or Section 149 (time limit for issuing notices). The privacy policy should reference the legal basis generically as "applicable tax and financial record-keeping laws." [ASSUMED]
**Warning signs:** Stating retention period without legal basis citation.

## Code Examples

### Jekyll Front Matter for URL Control
```markdown
---
layout: default
title: Privacy Policy
permalink: /privacy-policy
---

# Privacy Policy

**Version:** 1.0
**Effective Date:** [DATE]
**Last Updated:** [DATE]

...
```
[ASSUMED --- standard Jekyll front matter pattern]

### Privacy Policy Data Categories Table
```markdown
| Data Category | Examples | Purpose | Legal Basis (GDPR) | Retention |
|---------------|----------|---------|-------------------|-----------|
| Account/Identity | Email, name, phone, avatar | User authentication, profile | Art 6(1)(b) contract performance | Active account + 30 days |
| Property Data | Address, type, unit count, settings | Core app functionality | Art 6(1)(b) contract performance | Active + 30 days post-archival |
| Tenant Data | Name, flat number, rent amount, invite status | Rental management | Art 6(1)(b) contract + Art 6(1)(a) consent (for tenant-side) | Active + 30 days post-archival |
| Payment/Financial | Amounts, proof images, status, dates | Rent tracking, receipt generation | Art 6(1)(b) contract + Art 6(1)(c) legal obligation | 7 years (tax records) |
| Bot Conversations | Message content, AI responses | AI-powered assistance | Art 6(1)(a) explicit consent | 90 days rolling |
| Notifications | Type, title, body, read status | Payment reminders, confirmations | Art 6(1)(b) contract performance | 90 days |
| Push Tokens | Expo push token (device identifier) | Push notification delivery | Art 6(1)(b) contract performance | Until logout or account deletion |
```

### Sub-Processor Disclosure Table
```markdown
| Processor | Country | Purpose | Data Received | Transfer Basis | DPA |
|-----------|---------|---------|---------------|----------------|-----|
| Supabase Inc. | Japan (ap-northeast-1, AWS) | Backend: auth, database, storage, edge functions | All user data | EU adequacy (Japan) + SCCs (Supabase DPA) | [Supabase DPA](https://supabase.com/legal/dpa) |
| Anthropic PBC | United States | AI inference for bot features | Tenant context (names, addresses, rent amounts) — consent-gated | SCCs (Anthropic Commercial Terms) | Incorporated in Commercial Terms |
| Telegram | Global | User-initiated bot messaging channel | Bot messages, user Telegram ID — user-initiated only | User-initiated transfer | [Bot Developer ToS](https://telegram.org/tos/bot-developers) |
| Expo (+ Apple APNs, Google FCM) | United States | Push notification delivery | Device push tokens, notification content | SCCs (Expo Terms) | [Expo Terms](https://expo.dev/terms) |
```

### Data Sent to Anthropic (from process-bot-message/index.ts:784-834)
Based on verified code review, the `buildContext()` function sends to Anthropic:
- Property names, IDs, addresses, cities, unit counts
- Tenant names, IDs, flat numbers, monthly rent amounts, due days
- Payment statuses, amounts due, amounts paid for current month
- Current date context

This is the authoritative list for the "Data Received" column in the Anthropic sub-processor entry.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CCPA "Do Not Sell" only | CPRA "Do Not Sell or Share" | Jan 2023 (CPRA effective) | Must use "sell **or share**" language, not just "sell" [CITED: CCPA statute] |
| DPDP cross-border blacklist approach | Default permissive (no restricted list notified yet) | Aug 2023 (DPDP enacted) | Transfers permitted to all countries until govt notifies restrictions [VERIFIED: cross-border-transfers.md] |
| Separate DPA negotiation required | Most SaaS incorporate DPA by reference in standard terms | 2023-2024 trend | Supabase, Anthropic, Expo all use incorporated-by-reference DPAs [VERIFIED: dpa-register.md] |

**Deprecated/outdated:**
- "Privacy Shield" for US transfers: invalidated by Schrems II (2020). Use SCCs instead. [CITED: GDPR Art 46]
- CCPA pre-CPRA language ("Do Not Sell" without "or Share"): must include "Share" since Jan 2023

## GDPR Article 13 Mandatory Information Checklist

Source: [Art 13 GDPR full text](https://gdpr-info.eu/art-13-gdpr/) [CITED]

### Paragraph 1 (at time of collection)
| # | Required Information | Dwella Source |
|---|---------------------|---------------|
| 1 | Controller identity + contact | Solo developer name + email (D-12) |
| 2 | DPO contact details | "Not applicable" --- solo dev below threshold |
| 3 | Purposes + legal basis per processing | 7 data categories table (D-07) |
| 4 | Legitimate interests (if Art 6(1)(f)) | Not primary basis; contract performance (6(1)(b)) for most |
| 5 | Recipients / categories of recipients | 4 sub-processors (D-09) |
| 6 | Cross-border transfer details + safeguards | Japan (adequacy + SCCs), US (SCCs) (D-11) |

### Paragraph 2 (additional)
| # | Required Information | Dwella Source |
|---|---------------------|---------------|
| 7 | Retention periods or criteria | Per-category retention (D-08) |
| 8 | Data subject rights | Access, rectification, erasure, restriction, portability, objection |
| 9 | Right to withdraw consent | For AI features (consent-based), for tenant-side data sharing |
| 10 | Right to complain to supervisory authority | Name relevant DPA (user's local authority) |
| 11 | Whether provision is statutory/contractual | Email required for account; other data voluntary |
| 12 | Automated decision-making / profiling | AI bot assists but does not make binding decisions; disclose |

## DPDP Act 2023 Section 5 Notice Requirements

Source: [DPDP Act 2023 Section 5](https://dpdpa.com/dpdpa2023/chapter-2/section5.html) [CITED]

| # | Required Information | Dwella Implementation |
|---|---------------------|-----------------------|
| 1 | Personal data collected and purpose | 7 data categories table |
| 2 | How to exercise rights under S6(4) and S13 | Contact email + in-app flow (Phase 5) |
| 3 | How to complain to Data Protection Board of India | Include Board contact/URL |
| 4 | Contact details of grievance officer / authorized person | Developer email (D-14, COMP-09) |
| 5 | Clear and plain language, with option for Indian languages | English only at v1.0; Hindi deferred (FUT-06) |

## CCPA/CPRA Requirements for Privacy Policy

Source: [CCPA statute effective 2026-01-01](https://cppa.ca.gov/regulations/pdf/ccpa_statute_eff_20260101.pdf) [CITED]

| Requirement | Dwella Implementation |
|-------------|----------------------|
| Categories of PI collected in last 12 months | 7 data categories |
| Business/commercial purpose for each category | Purpose column in data categories table |
| Categories of sources | Directly from user (all categories) |
| Categories of third parties shared with | 4 sub-processors |
| "Do Not Sell or Share" disclosure | Affirmative statement: "Dwella does not sell or share your personal information" (D-15) |
| Consumer rights | Right to know, delete, correct, opt-out (of sale --- N/A), non-discrimination |

**Key finding:** Since Dwella does NOT sell or share personal information, no interactive opt-out form is required. An affirmative disclosure section is sufficient (D-16). [CITED: clym.io analysis of CCPA requirements]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Jekyll front matter `permalink` can override URL path on GitHub Pages `/docs` source | Architecture Patterns | URLs may not match D-02 expectations; would need file placement adjustment |
| A2 | Solo developer is below GDPR DPO appointment threshold | GDPR Checklist | If DPO is required, privacy policy needs DPO contact details |
| A3 | Indian Income Tax Act S44AA requires 6-year retention of financial records (rounded to 7y) | Pitfall 6 | Retention period may be wrong; could be shorter or longer |
| A4 | GitHub Pages renders Markdown files with default Jekyll theme without additional config | Architecture Patterns | May need `_config.yml` or theme setup |

## Open Questions (RESOLVED)

1. **Exact URL path resolution** — RESOLVED: Files placed in `docs/` directly with Jekyll `permalink` front matter per Plan 02-01 Task 1. URLs will resolve to `/Dwella-v2/privacy-policy` and `/Dwella-v2/terms-of-service`.

2. **Developer's real name and email in privacy policy** — RESOLVED: `{DEVELOPER_NAME}` and `{DEVELOPER_EMAIL}` placeholder tokens used throughout both documents; developer fills these in at Plan 02-03 checkpoint before publishing.

3. **Supervisory authority for complaints** — RESOLVED: Generic language used ("your local data protection supervisory authority"); DPDP section specifically names the Data Protection Board of India.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification (no automated tests --- this phase produces documents, not code) |
| Config file | N/A |
| Quick run command | `curl -s -o /dev/null -w "%{http_code}" https://hruaia21hrahsel.github.io/Dwella-v2/privacy-policy` |
| Full suite command | Verify all URLs return 200, verify all 12 GDPR Art 13 items present, verify DPDP S5 items, verify CCPA section |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEGAL-01 | Privacy policy accessible at stable URL, contains GDPR/DPDP/CCPA content | manual + smoke | `curl -I https://hruaia21hrahsel.github.io/Dwella-v2/privacy-policy` | Wave 0 |
| LEGAL-02 | Privacy policy lists all 4 sub-processors with required details | manual checklist | Grep for "Supabase", "Anthropic", "Telegram", "Expo" in privacy-policy.md | Wave 0 |
| LEGAL-03 | ToS accessible, covers both roles, has record-keeper disclaimer, India governing law | manual checklist | `curl -I https://hruaia21hrahsel.github.io/Dwella-v2/terms-of-service` | Wave 0 |
| LEGAL-04 | ToS has forward-looking paid-features clause | manual checklist | Grep for "paid" or "premium" or "subscription" in terms-of-service.md | Wave 0 |
| COMP-08 | CCPA "Do Not Sell" section present | manual checklist | Grep for "Do Not Sell" in privacy-policy.md | Wave 0 |
| COMP-09 | DPDP grievance officer contact present | manual checklist | Grep for "grievance" in privacy-policy.md | Wave 0 |

### Sampling Rate
- **Per task commit:** Visual review of document content + grep verification of mandatory items
- **Per wave merge:** Full URL accessibility test after GitHub Pages deployment
- **Phase gate:** All 6 requirements verified with checklist before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] GitHub Pages must be enabled in repo settings (manual step)
- [ ] URLs must be tested after deployment (cannot pre-verify)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A --- this phase produces static documents |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | No | N/A --- no user input in static docs |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for Static GitHub Pages

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Document tampering via repo access | Tampering | Git commit signing, branch protection rules |
| Phishing via fake privacy policy URL | Spoofing | Use exact URL from D-02, verify in app and store submissions |

**Note:** This phase has minimal security surface. The documents are public by design. The main risk is ensuring the published content accurately reflects actual data practices (a legal compliance risk, not a security one).

## Sources

### Primary (HIGH confidence)
- [GDPR Article 13 full text](https://gdpr-info.eu/art-13-gdpr/) --- all 12 mandatory information items verified
- [DPDP Act 2023 Section 5](https://dpdpa.com/dpdpa2023/chapter-2/section5.html) --- notice requirements
- [GitHub Pages configuration docs](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) --- `/docs` folder source
- `.planning/legal/dpa-register.md` --- sub-processor list with DPA evidence (project file, verified)
- `.planning/legal/cross-border-transfers.md` --- transfer analysis (project file, verified)
- `lib/types.ts` --- data model for privacy policy data categories (project file, verified)
- `supabase/functions/process-bot-message/index.ts:784-834` --- data sent to Anthropic (project file, verified)

### Secondary (MEDIUM confidence)
- [ICO Right to be Informed guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/) --- UK ICO interpretation of Art 13/14
- [CCPA statute effective 2026-01-01](https://cppa.ca.gov/regulations/pdf/ccpa_statute_eff_20260101.pdf) --- CCPA/CPRA current text
- [Clym CCPA "Do Not Sell" analysis](https://www.clym.io/blog/ccpa-not-sell-or-share-requirement) --- affirmative disclosure requirements

### Tertiary (LOW confidence)
- Indian Income Tax Act S44AA retention period (7 years) --- [ASSUMED], not verified against primary statute text

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH --- GitHub Pages is well-documented, no code dependencies
- Architecture: HIGH --- GDPR Art 13 requirements are explicit in statute text, verified
- Pitfalls: HIGH --- based on verified regulatory requirements and project-specific code review
- Retention periods: MEDIUM --- most are locked decisions from CONTEXT.md; 7-year tax retention is assumed
- URL resolution: MEDIUM --- GitHub Pages `/docs` folder behavior verified, but exact permalink behavior with Jekyll needs testing

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (30 days --- legal requirements are stable, GitHub Pages features change slowly)
