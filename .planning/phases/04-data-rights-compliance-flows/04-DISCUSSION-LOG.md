# Phase 4: Data Rights & Compliance Flows - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 04-data-rights-compliance-flows
**Areas discussed:** Erasure strategy, Account deletion UX, Data export format, Retention enforcement

---

## Erasure Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Anonymize in place | SET tenant_name='[deleted]', NULL personal fields, keep amounts. Migration changes ON DELETE RESTRICT to ON DELETE SET NULL + trigger | Yes |
| Move to archive table | Copy to payments_archive with PII stripped, delete originals | |
| Hard-delete everything | Delete all payment rows regardless of age | |

**User's choice:** Anonymize in place
**Notes:** Satisfies financial record retention + GDPR erasure simultaneously

### Expenses sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Same pattern as payments | NULL out user_id/description, keep amount/category/date | Yes |
| Hard-delete expenses | Landlord's own data, acceptable to delete on their account deletion | |

**User's choice:** Same pattern as payments

### Storage files sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Delete all storage files | Remove payment-proofs, receipts, avatars | Yes |
| Keep receipt PDFs, delete proofs + avatars | Receipts as financial records, proofs/avatars as PII | |

**User's choice:** Delete all storage files

### Dual-role sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Erase both roles | Delete/anonymize landlord data AND tenant linkages | Yes |
| Erase landlord, unlink tenant only | Remove owned properties, NULL user_id on tenant rows | |

**User's choice:** Erase both roles

---

## Account Deletion UX

### Grace period

| Option | Description | Selected |
|--------|-------------|----------|
| 30-day grace period | Mark for deletion, disable login, erase after 30 days | Yes |
| Immediate deletion | Erase everything on confirm | |
| 7-day grace period | Shorter window | |

**User's choice:** 30-day grace period

### Confirmation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Type 'DELETE' to confirm | Standard destructive-action pattern | Yes |
| Two-tap confirmation | Alert dialog with 'Are you sure?' | |
| Re-authenticate + confirm | Password/biometric re-entry | |

**User's choice:** Type 'DELETE' to confirm

### Button placement

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom of profile, red text | Danger Zone section, discoverable but not prominent | Yes |
| Separate 'Account' sub-screen | 3 taps from tab, more buried | |

**User's choice:** Bottom of profile, red text

### Telegram cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Unlink + notify via bot | Send final message, clear chat_id | Yes |
| Silent unlink only | Just NULL the telegram_chat_id | |

**User's choice:** Unlink + notify via bot

---

## Data Export Format

### Format

| Option | Description | Selected |
|--------|-------------|----------|
| JSON download | Single JSON with sections per table, machine-readable | Yes |
| JSON + PDF summary | JSON for data + PDF for human reading | |
| PDF only | Human-readable but not machine-readable | |

**User's choice:** JSON download

### Delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Edge Function + signed URL | Assemble JSON, upload to Storage, return signed URL | Yes |
| In-app file share | Write to device, open share sheet | |
| Email the export | Generate and email | |

**User's choice:** Edge Function + signed URL

### Attachments

| Option | Description | Selected |
|--------|-------------|----------|
| JSON only, no files | Structured data only, proof_url fields preserved | Yes |
| Include signed URLs to files | JSON with temporary signed URLs | |
| Full ZIP bundle with files | ZIP with JSON + all images/PDFs | |

**User's choice:** JSON only, no files

---

## Retention Enforcement

### Job design

| Option | Description | Selected |
|--------|-------------|----------|
| New Edge Function + pg_cron | New enforce-retention function, daily schedule | Yes |
| Database function (plpgsql) | Pure SQL via pg_cron, no Edge Function | |
| Piggyback on mark-overdue | Add to existing daily function | |

**User's choice:** New Edge Function + pg_cron

### Retention windows

| Option | Description | Selected |
|--------|-------------|----------|
| Use Phase 2 defaults as-is | Archived: 30d, bot/notifications: 90d, payments: 7yr | Yes |
| Shorter windows | Archived: 7d, bot/notifications: 30d | |
| You decide | Let Claude pick during planning | |

**User's choice:** Use Phase 2 defaults as-is

### Rate limit cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include it | Delete entries older than 1 hour in retention job | Yes |
| No, separate concern | Handle rate limit cleanup separately | |

**User's choice:** Yes, include it

---

## Claude's Discretion

- Exact anonymization trigger SQL
- Migration numbering
- Edge Function error handling patterns
- Whether deletion_scheduled_at goes on users table or separate table
- Exact JSON schema for export bundle
- Rate limit cleanup SQL

## Deferred Ideas

- Email notification on deletion request — no email infra
- Self-service deletion cancellation via app — email-based for v1.0
- Data export with Storage files (ZIP) — complexity
- Granular record deletion — not required by GDPR
- Automated DSAR tracking — manual for v1.0
