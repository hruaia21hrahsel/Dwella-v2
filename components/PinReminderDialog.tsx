/**
 * PinReminderDialog
 *
 * Modal CTA that nudges authenticated users to set up a PIN lock if they
 * haven't done so yet. Shows once per fresh login — the `pinReminderDismissed`
 * flag is in-memory only and is reset to false on every SIGNED_IN event by
 * AuthGuard. Users can either jump to /pin-setup or dismiss for this session.
 *
 * Hidden while the user is on an auth, onboarding, pin-setup, or lock screen,
 * and while the in-app tour is running.
 */

import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';
import { isPinSet } from '@/lib/biometric-auth';
import { haptics } from '@/lib/haptics';

// Grace period after the session becomes available before the dialog is
// allowed to render. On cold launch, expo-router's segments briefly
// reflect the previously visited route (e.g. "(tabs)") before AuthGuard's
// async routing effect redirects to /lock or /onboarding. Without this
// delay the dialog evaluates visibility against stale segments and flashes
// for a single frame before the redirect hides it.
const ROUTING_SETTLE_MS = 700;

export function PinReminderDialog() {
  const { session, isLoading, isLocked, tourStep, pinReminderDismissed, setPinReminderDismissed } = useAuthStore();
  const [pinReady, setPinReady] = useState<boolean | null>(null);
  const [settled, setSettled] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const { colors, shadows } = useTheme();

  const uid = session?.user?.id;

  // Re-check PIN status whenever the signed-in user changes OR the dismiss
  // flag flips back to false (fresh login). The dependency on
  // pinReminderDismissed ensures the dialog shows after a logout/login even
  // if the user id happens to be the same.
  useEffect(() => {
    if (!uid) {
      setPinReady(null);
      return;
    }
    let cancelled = false;
    isPinSet(uid).then((v) => {
      if (!cancelled) setPinReady(v);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, pinReminderDismissed]);

  // Arm the settle timer: wait until after the session is loaded AND the
  // app is unlocked (the lock screen is gone) before letting the dialog
  // render. Reset when the user logs out or gets re-locked.
  useEffect(() => {
    if (!session || isLoading || isLocked) {
      setSettled(false);
      return;
    }
    const t = setTimeout(() => setSettled(true), ROUTING_SETTLE_MS);
    return () => clearTimeout(t);
  }, [session, isLoading, isLocked]);

  const inAuthGroup = segments[0] === '(auth)' || segments[0] === 'auth';
  const inPinSetup = segments[0] === 'pin-setup';
  const inOnboarding = segments[0] === 'onboarding';

  const visible =
    settled &&
    !isLoading &&
    !isLocked &&
    !!session &&
    pinReady === false &&
    !pinReminderDismissed &&
    tourStep === null &&
    !inAuthGroup &&
    !inPinSetup &&
    !inOnboarding;

  function handleSetup() {
    haptics.medium();
    setPinReminderDismissed(true);
    router.push('/pin-setup');
  }

  function handleDismiss() {
    haptics.tap();
    setPinReminderDismissed(true);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, ...shadows.hero }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <MaterialCommunityIcons name="shield-lock-outline" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Secure your account</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Set up a 4-digit PIN to protect your Dwella data. You'll enter it each time you open
            the app, keeping your property and tenant info safe.
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={handleSetup}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Set up PIN now"
          >
            <MaterialCommunityIcons name="lock-plus-outline" size={18} color={colors.textOnPrimary} />
            <Text style={[styles.primaryText, { color: colors.textOnPrimary }]}>Set Up PIN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss PIN reminder"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 100,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 8,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
