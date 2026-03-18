import { usePostHog } from 'posthog-react-native';
import { type PostHogEventProperties } from '@posthog/core';
import { useCallback } from 'react';

// ── Event Names ────────────────────────────────────────────────────────
export const EVENTS = {
  // Activation & Onboarding
  SIGNUP_COMPLETED: 'signup_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  PIN_SETUP_COMPLETED: 'pin_setup_completed',
  FIRST_PROPERTY_CREATED: 'first_property_created',
  FIRST_TENANT_ADDED: 'first_tenant_added',
  FIRST_INVITE_SENT: 'first_invite_sent',
  INVITE_ACCEPTED: 'invite_accepted',

  // Core Loop — Payments
  PAYMENT_LOGGED: 'payment_logged',
  PAYMENT_MARKED_PAID: 'payment_marked_paid',
  PAYMENT_PROOF_UPLOADED: 'payment_proof_uploaded',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  PAYMENT_RECEIPT_EXPORTED: 'payment_receipt_exported',

  // AI & Bot
  BOT_MESSAGE_SENT: 'bot_message_sent',
  BOT_ACTION_CONFIRMED: 'bot_action_confirmed',
  BOT_ACTION_CANCELLED: 'bot_action_cancelled',
  AI_INSIGHTS_VIEWED: 'ai_insights_viewed',
  AI_REMINDERS_DRAFTED: 'ai_reminders_drafted',
  AI_SEARCH_PERFORMED: 'ai_search_performed',
  AI_NUDGE_TAPPED: 'ai_nudge_tapped',

  // Property & Tenant Management
  PROPERTY_CREATED: 'property_created',
  PROPERTY_ARCHIVED: 'property_archived',
  TENANT_ADDED: 'tenant_added',
  TENANT_ARCHIVED: 'tenant_archived',
  EXPENSE_LOGGED: 'expense_logged',

  // Engagement & Retention
  NOTIFICATION_TAPPED: 'notification_tapped',
  THEME_CHANGED: 'theme_changed',
  TELEGRAM_LINKED: 'telegram_linked',
  TELEGRAM_UNLINKED: 'telegram_unlinked',
  WHATSAPP_LINKED: 'whatsapp_linked',
  WHATSAPP_UNLINKED: 'whatsapp_unlinked',
  APP_TOUR_REPLAYED: 'app_tour_replayed',
} as const;

// ── Hook ───────────────────────────────────────────────────────────────
export function useTrack() {
  const posthog = usePostHog();
  return useCallback(
    (event: string, properties?: PostHogEventProperties) => {
      posthog.capture(event, properties);
    },
    [posthog],
  );
}

// ── Non-hook capture (for use outside components) ──────────────────────
// Import posthog-react-native's default instance for fire-and-forget captures
// in plain functions (e.g. lib/invite.ts).  Falls back silently if PostHog
// hasn't initialised yet.
export { usePostHog } from 'posthog-react-native';
