# Cross-Border Data Transfer Analysis --- Dwella v1.0

**Purpose:** Document the legal basis for transfers of personal data across borders between Dwella users and each sub-processor. Feeds directly into Phase 2 privacy policy LEGAL-02 language.

**Last updated:** 2026-04-06

## Supabase --- Region of Record

**Confirmed region:** `ap-northeast-1` (Northeast Asia / Tokyo)
**Provider:** AWS (t4g.micro instance)
**Source of truth:** Supabase dashboard -> Project Settings -> General -> Region, confirmed on 2026-04-06.

## GDPR (EU/EEA/UK) users

Region is outside EU (`ap-northeast-1` / Tokyo, Japan). GDPR Chapter V transfer applies.

> EU/EEA/UK users' personal data is transferred to `ap-northeast-1` (Tokyo, Japan) under GDPR Article 46 Standard Contractual Clauses, incorporated via the Supabase DPA (https://supabase.com/legal/dpa). Japan has an EU adequacy decision (January 2019, reaffirmed), which provides an additional legal basis. The privacy policy will disclose the specific region and the SCC + adequacy basis. Additional transfers: (a) Anthropic (US) for AI features --- SCCs via Anthropic Commercial Terms, (b) Expo/APNs/FCM for push delivery.

## DPDP Act 2023 (India) users

Under DPDP Act 2023 S16 and the current notification regime, cross-border transfer of personal data is permitted by default to all jurisdictions except those the Indian government has specifically notified as restricted. As of 2026-04-06, no restricted-country list has been notified. Indian users' data may be transferred to `ap-northeast-1` (Tokyo, Japan) and the US (Anthropic) under the DPDP's default permissive regime.

## CCPA/CPRA (California) users

CCPA does not restrict cross-border transfers. California users' data flows follow the same sub-processor list as above. CCPA's "do not sell" and affirmative disclosure obligations are handled in Phase 2 (LEGAL-01 / COMP-08).

## Anthropic (US) --- AI Features

Any user who opts into AI bot features (Phase 5 LEGAL-06 consent gate) has tenant-context data sent to Anthropic in the US. SCC basis is incorporated via Anthropic Commercial Terms. Users who decline AI features have zero data sent to Anthropic.

## Conclusion

Cross-border transfer legal bases are identified for every sub-processor and every target user jurisdiction. Supabase data resides in Japan (`ap-northeast-1`), which benefits from an EU adequacy decision (additional to SCCs in the Supabase DPA). Anthropic data flows to the US under SCCs incorporated via Commercial Terms. DPDP Act 2023 permits transfers to both Japan and the US by default (no restricted-country notification issued). CCPA imposes no cross-border transfer restrictions. All transfer mechanisms are documented and ready for Phase 2 privacy policy drafting. **GO.**
