/**
 * TelegramLinkReminderDialog
 *
 * Modal CTA that nudges authenticated users to link their Telegram account
 * so they can use the AI assistant in Telegram. Sequenced AFTER the PIN
 * reminder — visible only once the PIN CTA has been either resolved
 * (pinReady === true) or dismissed (pinReminderDismissed === true). Resets
 * on every SIGNED_IN event via AuthGuard.
 *
 * Hidden while the user is on an auth, onboarding, pin-setup, or lock screen,
 * and while the in-app tour is running.
 */

import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useSegments } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';
import { useToastStore } from '@/lib/toast';
import { isPinSet } from '@/lib/biometric-auth';
import { generateTelegramLinkToken } from '@/lib/bot';
import { TELEGRAM_BOT_USERNAME } from '@/constants/config';

// See PinReminderDialog for the rationale behind this settle delay.
const ROUTING_SETTLE_MS = 700;

export function TelegramLinkReminderDialog() {
  const {
    session,
    user,
    isLoading,
    isLocked,
    tourStep,
    pinReminderDismissed,
    telegramReminderDismissed,
    setTelegramReminderDismissed,
  } = useAuthStore();
  const [pinReady, setPinReady] = useState<boolean | null>(null);
  const [linking, setLinking] = useState(false);
  const [settled, setSettled] = useState(false);
  const segments = useSegments();
  const { colors, shadows } = useTheme();

  const uid = session?.user?.id;

  // Mirror PinReminderDialog's PIN check so we can gate on "PIN flow resolved".
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

  // Settle gate — don't evaluate visibility until the initial routing
  // transition on cold launch has had time to finish. Matches
  // PinReminderDialog so both dialogs stay silent during the splash → app
  // handoff.
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

  // PIN CTA is "resolved" if the user already has a PIN OR they explicitly
  // dismissed the PIN dialog this session. Either condition releases the
  // queue for the Telegram CTA.
  const pinCtaResolved = pinReady === true || pinReminderDismissed === true;

  const telegramLinked = !!user?.telegram_chat_id;

  const visible =
    settled &&
    !isLoading &&
    !isLocked &&
    !!session &&
    !!user &&
    !telegramLinked &&
    !telegramReminderDismissed &&
    pinCtaResolved &&
    tourStep === null &&
    !inAuthGroup &&
    !inPinSetup &&
    !inOnboarding;

  async function handleLink() {
    if (!uid || linking) return;
    setLinking(true);
    try {
      const token = await generateTelegramLinkToken(uid);
      const deepLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`;
      await Linking.openURL(deepLink);
      setTelegramReminderDismissed(true);
    } catch (err) {
      useToastStore.getState().showToast(
        err instanceof Error ? err.message : 'Could not start Telegram link',
        'error',
      );
    } finally {
      setLinking(false);
    }
  }

  function handleDismiss() {
    setTelegramReminderDismissed(true);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, ...shadows.hero }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <MaterialCommunityIcons name="send-circle-outline" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Chat with Dwella on Telegram</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Link your Telegram account to message the Dwella AI assistant, log payments, and get
            updates — all from inside Telegram.
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: linking ? 0.6 : 1 }]}
            onPress={handleLink}
            disabled={linking}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Link Telegram now"
          >
            <MaterialCommunityIcons name="link-variant" size={18} color={colors.textOnPrimary} />
            <Text style={[styles.primaryText, { color: colors.textOnPrimary }]}>
              {linking ? 'Opening Telegram…' : 'Link Telegram'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss Telegram reminder"
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
