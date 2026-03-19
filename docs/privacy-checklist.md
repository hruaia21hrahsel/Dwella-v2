# Dwella — App Store Connect Privacy Checklist

Reference for manually filling out the App Store Connect privacy section.

## Third-Party Data Destinations

| Third-Party Service | Data Collected | Apple Category | Linked to Identity | Purpose |
|---|---|---|---|---|
| Supabase | Email address, user ID | Contact Info, Identifiers | Yes — account | App Functionality |
| Supabase | Property names, addresses, tenant names, payment amounts | User Content, Financial Info | Yes — account | App Functionality |
| Claude API (Anthropic) | Property names, tenant names, payment info (sent in AI prompts) | User Content | Yes — account | App Functionality |
| PostHog | User ID, analytics events, feature usage | Identifiers, Usage Data | Yes — via posthog.identify() | Analytics |
| Sentry | Crash reports, stack traces | Diagnostics | No — anonymous | App Functionality |
| Expo Push Notifications | Push token, device identifier | Identifiers | Yes — linked to user account | App Functionality |
| Telegram Bot API | Chat messages relayed by user action | User Content | Yes — user-initiated | App Functionality |
| WhatsApp Business API | Chat messages relayed by user action | User Content | Yes — user-initiated | App Functionality |

## Tracking Declaration

No cross-app or cross-website tracking. No ATT prompt needed. PostHog identify() is first-party only — user IDs are not shared with ad networks or data brokers, and are not used to track users across apps or websites owned by other companies.

## Data Not Collected

The following data categories are **not** collected by Dwella:

- Location (precise or coarse)
- Health or fitness data
- Financial card numbers or banking credentials
- Browsing history or web activity
- Contacts or address book
