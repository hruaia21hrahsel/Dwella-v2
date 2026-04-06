# Phase 2: Legal Artifact Drafting - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-06
**Phase:** 02-legal-artifact-drafting
**Mode:** assumptions (--auto)
**Areas analyzed:** Hosting Strategy, Document Structure, Data Categories, Sub-Processor Disclosure, Governing Law, CCPA Compliance, Forward-Looking Monetization

## Assumptions Presented

### Hosting Strategy
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| GitHub Pages from existing repo for legal doc hosting | Likely | No existing hosting infra, repo on GitHub, zero budget, no website on main |
| Supabase Edge Function as alternative (invite-redirect pattern) | Likely | `supabase/functions/invite-redirect/index.ts` serves HTML |

### Document Structure
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Single document per artifact with jurisdiction sections | Confident | PROJECT.md line 15-16 explicitly locks this |

### Data Categories and Retention
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| 7 data categories from types.ts | Confident | `lib/types.ts` defines User, Property, Tenant, Payment, BotConversation, Notification entities |
| Retention periods must be defined in this phase | Confident | GDPR Art 13(2)(a) requires specific periods; none defined anywhere in codebase |

### Data Controller and Governing Law
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Solo developer as natural person, India governing law | Confident | PROJECT.md lines 94-98, Anthropic receipt shows Aizawl, Mizoram |

### Forward-Looking Monetization
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| General placeholder clause, no IAP terms | Likely | LEGAL-04 requirement, FUT-08 defers actual IAP |

## Corrections Made

No corrections — all assumptions auto-confirmed (--auto mode).

## Auto-Resolved

- Hosting Strategy: auto-selected GitHub Pages as primary (Likely → treated as decided)
- Forward-Looking Monetization: auto-selected general placeholder clause (Likely → treated as decided)

## External Research Flagged

- GDPR Article 13/14 mandatory sections checklist — regulatory reference needed
- DPDP Act 2023 Section 5 notice format — MeitY guidance needed
- CCPA "Do Not Sell" implementation requirements — regulatory reference needed
- Retention period best practices for rental/financial data — cross-jurisdiction research needed
