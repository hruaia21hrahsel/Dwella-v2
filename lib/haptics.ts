/**
 * Thin wrapper around expo-haptics so the rest of the app doesn't need to
 * care about the underlying API or worry about unsupported platforms.
 * Every function is fire-and-forget — haptics are a polish layer, not a
 * correctness layer, and should never block or throw.
 *
 * Naming convention:
 *   - tap()     : Selection — lightest, for incidental navigation/toggles
 *   - light()   : Light impact — primary button presses
 *   - medium()  : Medium impact — commitments, CTAs, confirmations
 *   - heavy()   : Heavy impact — destructive or momentous actions
 *   - success() : Notification success — completed operations
 *   - warning() : Notification warning — blocked/risky actions
 *   - error()   : Notification error — failed operations
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics on web are a no-op; skip the call entirely so we don't log
// promise rejections on web builds.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function safe(fn: () => Promise<unknown>) {
  if (!enabled) return;
  fn().catch(() => {
    // Swallow — haptic failures must never propagate to the UI.
  });
}

export const haptics = {
  tap: () => safe(() => Haptics.selectionAsync()),
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
