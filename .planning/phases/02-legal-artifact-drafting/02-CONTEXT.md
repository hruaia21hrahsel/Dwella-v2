# Phase 2: Legal Artifact Drafting - Context

**Gathered:** 2026-04-06 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Produce the hosted legal documents the app, stores, and users will reference — with jurisdiction-specific sections layered in where law requires. This phase WRITES the documents; it does NOT implement in-app consent flows (Phase 5), account deletion (Phase 4), or store submission forms (Phase 6).

**In scope:** Privacy Policy, Terms of Service / EULA, CCPA "Do Not Sell" section, DPDP grievance officer contact, hosting setup, forward-looking monetization clause.

**Out of scope:** In-app consent UI (Phase 5), account deletion flow (Phase 4), store nutrition labels (Phase 6), security hardening (Phase 3).

</domain>

<decisions>
## Implementation Decisions

### Hosting Strategy
- **D-01:** Host legal documents as static Markdown/HTML on GitHub Pages from the existing repo (`hruaia21hrahsel.github.io/Dwella-v2/`), using a `docs/legal/` subfolder or GitHub Pages branch. Free, stable URL, no additional infrastructure. The solo developer has zero budget for hosting.
- **D-02:** URL format: `https://hruaia21hrahsel.github.io/Dwella-v2/privacy-policy` and `.../terms-of-service`. These URLs will be referenced by app.json, in-app settings (Phase 5), and store submissions (Phase 6). Stability is critical — do not change the URL pattern after this phase.
- **D-03:** If GitHub Pages is rejected later (repo goes private, custom domain desired), the URL can be redirected, but all downstream references depend on whatever URL is chosen here.

### Document Structure and Jurisdiction Layering
- **D-04:** Single document per artifact (one Privacy Policy, one ToS) with jurisdiction-specific sections layered in — NOT separate per-jurisdiction documents. This is locked per PROJECT.md: "one set of docs, jurisdiction-specific sections where law requires them."
- **D-05:** Privacy Policy structure: GDPR Articles 13/14 baseline (strictest), with clearly marked `### For users in India (DPDP Act 2023)` and `### For users in California (CCPA/CPRA)` sections where requirements differ.
- **D-06:** ToS structure: universal terms covering both landlord and tenant roles, with a clear disclaimer that Dwella is a record-keeper (not a payment processor, escrow agent, or legal advisor).

### Data Categories and Retention
- **D-07:** Privacy Policy must enumerate 7 data categories each with purpose, legal basis, and retention period:
  1. Account/identity data (email, name, phone, avatar)
  2. Property data (address, type, settings)
  3. Tenant data (name, flat number, monthly rent, invite status)
  4. Payment/financial data (amounts, proof images, status)
  5. Bot conversation logs (message content sent to Claude API)
  6. Notification records
  7. Push tokens (Expo push tokens for APNs/FCM)
- **D-08:** Retention periods must be DEFINED in this phase (not deferred to Phase 4), because GDPR Art 13(2)(a) requires specific periods. Recommended defaults for researcher to validate:
  - Account data: retained while account is active + 30 days after deletion
  - Property/tenant data: retained while active + 30 days after archival
  - Payment/financial data: 7 years (Indian Income Tax Act requirement for financial records)
  - Bot conversation logs: 90 days rolling (context window purpose, no long-term retention needed)
  - Notifications: 90 days
  - Push tokens: until user logs out or deletes account

### Sub-Processor Disclosure
- **D-09:** Sub-processor list must match `.planning/legal/dpa-register.md` exactly — 4 processors:
  1. **Supabase** (ap-northeast-1, Tokyo, Japan, AWS) — primary backend, all user data
  2. **Anthropic** (US) — AI bot inference, receives tenant context on bot messages, consent-gated
  3. **Telegram** (global) — user-initiated bot channel, data flows only after user links chat
  4. **Expo Push** (US relay to APNs/FCM) — push notification delivery
- **D-10:** Each processor entry must include: processor name, country, purpose, data categories received, legal basis for transfer, and DPA reference.
- **D-11:** Cross-border transfer disclosure per `.planning/legal/cross-border-transfers.md`: Japan (adequacy + SCCs), US (SCCs via Commercial Terms), Telegram (user-initiated).

### Data Controller and Governing Law
- **D-12:** Data controller is the solo individual developer (natural person, not a legal entity). Privacy policy names a natural person with contact email. This exposes personal liability — PROJECT.md acknowledges this and defers entity formation (FUT-05).
- **D-13:** Governing law: India (developer's country of residence — Aizawl, Mizoram).
- **D-14:** DPDP grievance officer contact: the developer's email address (COMP-09). Can be updated if an entity is formed later.

### CCPA Compliance
- **D-15:** "Do Not Sell or Share My Personal Information" section required even though Dwella does not sell data. CCPA/CPRA requires the affirmative disclosure. Language should state: "Dwella does not sell or share your personal information as defined by the CCPA/CPRA."
- **D-16:** No interactive opt-out mechanism needed at v1.0 since no selling/sharing occurs. A simple disclosure section suffices.

### Forward-Looking Monetization
- **D-17:** ToS includes a general "future paid features" clause reserving the right to introduce premium tiers without specifying pricing or features. States that users will be notified of material changes. Broad enough to cover subscription, one-time purchase, or freemium models without requiring a full ToS rewrite.
- **D-18:** No actual IAP terms at v1.0 — clause is placeholder only. Real payment terms added in future milestone (FUT-08).

### Claude's Discretion
- Exact legal language and clause wording (researcher should reference GDPR/DPDP/CCPA text and templates)
- Document formatting (Markdown vs HTML rendering)
- Whether to include a table of contents in long documents
- Cookie policy section handling (since there are zero cookies/trackers, a brief "we don't use cookies" statement)
- Version numbering scheme for legal documents (e.g., "v1.0, effective 2026-XX-XX")

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 outputs (ground truth for this phase)
- `.planning/legal/dpa-register.md` — Sub-processor list with DPA evidence (Anthropic, Supabase, Telegram, Expo)
- `.planning/legal/cross-border-transfers.md` — GDPR/DPDP/CCPA transfer analysis with confirmed region
- `.planning/PROJECT.md` §Infrastructure — Supabase region ap-northeast-1 (Tokyo, AWS)
- `.planning/legal/tracker-audit.md` — Zero-tracker attestation (static grep section complete)
- `THIRD-PARTY-LICENSES.md` — Runtime dependency license attestation

### Project-level
- `.planning/PROJECT.md` — Publisher identity (solo developer, India), constraints, data flows
- `.planning/REQUIREMENTS.md` §§ LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, COMP-08, COMP-09
- `.planning/ROADMAP.md` Phase 2 section — goal + success criteria

### Data model (feeds privacy policy data categories)
- `lib/types.ts` — TypeScript interfaces for all DB tables (User, Property, Tenant, Payment, etc.)
- `supabase/functions/process-bot-message/index.ts` lines 784-834 — data sent to Anthropic

### App configuration (legal URL integration points)
- `app.json` — currently has NO legal URL fields; Phase 6 will add them
- `app/(tabs)/profile/` — settings screen where Phase 5 will add legal links

### External regulatory references (not in repo — researcher must reference)
- GDPR Articles 13, 14 (mandatory privacy notice content)
- GDPR Article 28 (processor obligations — DPA requirements)
- GDPR Article 46 (SCCs for cross-border transfers)
- DPDP Act 2023 §5 (notice to data principal), §8 (data principal rights), §16 (cross-border transfer)
- CCPA/CPRA §1798.100-199 (consumer rights, "Do Not Sell" disclosure)
- Apple App Store Review Guidelines §5.1 (privacy requirements)
- Google Play Developer Content Policy (privacy section)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/legal/dpa-register.md` — complete sub-processor list ready to be transcribed into privacy policy
- `.planning/legal/cross-border-transfers.md` — cross-border analysis ready to be transcribed into transfer disclosure section
- `lib/types.ts` — authoritative data model for enumerating data categories
- `THIRD-PARTY-LICENSES.md` — dependency attestation, can be cross-referenced in privacy policy

### Established Patterns
- `supabase/functions/invite-redirect/index.ts` — existing pattern of edge function serving HTML pages (proves Supabase can host HTML, but GitHub Pages is preferred for legal docs)
- Soft-delete pattern (`is_archived = TRUE`) — privacy policy must disclose that "deletion" means archival initially, with hard-delete available via account deletion flow (Phase 4)
- Dual-role system — ToS must address both landlord and tenant perspectives in every clause

### Integration Points
- `app.json` — will receive `privacyPolicyUrl` and `termsOfServiceUrl` fields in Phase 6
- Profile/settings screen — Phase 5 will add links to these documents
- App Store Connect / Play Console — Phase 6 will reference these URLs in privacy declaration forms

</code_context>

<specifics>
## Specific Ideas

- Privacy Policy should have a clear "last updated" date and version number at the top for audit trail
- The "we don't sell your data" CCPA disclosure should be prominent, not buried in fine print
- ToS disclaimer about Dwella being a record-keeper (not payment processor) should be in bold/highlighted — this is a liability shield
- Consider a brief "plain English" summary at the top of each document for accessibility (not legally binding, but user-friendly)

</specifics>

<deferred>
## Deferred Ideas

- Cookie consent banner — not needed (zero cookies/trackers), but if trackers are ever added, Phase 5 would need to implement one
- In-app acceptance UI — Phase 5 (LEGAL-05)
- AI consent gate — Phase 5 (LEGAL-06)
- Account deletion flow — Phase 4 (COMP-01)
- Data export/portability — Phase 4 (COMP-04)
- Store privacy labels — Phase 6 (STORE-02, STORE-03)
- Legal entity formation — FUT-05 (post-launch)
- Multi-language translations of legal docs — FUT-06

### Reviewed Todos (not folded)
None — no pending todos matched Phase 2.

</deferred>

---

*Phase: 02-legal-artifact-drafting*
*Context gathered: 2026-04-06 (assumptions mode)*
