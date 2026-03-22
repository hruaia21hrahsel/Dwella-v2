import { useState, useEffect } from 'react';
import { StyleSheet, View, Linking } from 'react-native';
import { Modal, Portal, Text, Button, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';
import { isBiometricEnabled } from '@/lib/biometric-auth';
import { generateTelegramLinkToken } from '@/lib/bot';
import { TELEGRAM_BOT_USERNAME, WHATSAPP_BOT_PHONE } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/lib/toast';

// Track per-session so the modal doesn't nag after dismissal
let dismissedThisSession = false;

interface SetupItem {
  key: string;
  icon: string;
  title: string;
  description: string;
}

export function SetupPromptModal() {
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<SetupItem[]>([]);
  const [linkingTelegram, setLinkingTelegram] = useState(false);

  useEffect(() => {
    if (!user?.id || dismissedThisSession) return;

    // Small delay so the dashboard loads first
    const timer = setTimeout(async () => {
      const missing: SetupItem[] = [];

      // Check PIN
      const pinSet = await isBiometricEnabled(user.id);
      if (!pinSet) {
        missing.push({
          key: 'pin',
          icon: 'lock-outline',
          title: 'Set up a PIN',
          description: 'Protect your account with a 6-digit PIN for quick access.',
        });
      }

      // Check Telegram
      if (!user.telegram_chat_id && TELEGRAM_BOT_USERNAME) {
        missing.push({
          key: 'telegram',
          icon: 'send',
          title: 'Link Telegram',
          description: 'Chat with your AI assistant and get rent reminders on Telegram.',
        });
      }

      // Check WhatsApp
      if (!user.whatsapp_phone && WHATSAPP_BOT_PHONE) {
        missing.push({
          key: 'whatsapp',
          icon: 'whatsapp',
          title: 'Link WhatsApp',
          description: 'Receive rent reminders and manage properties via WhatsApp.',
        });
      }

      if (missing.length > 0) {
        setItems(missing);
        setVisible(true);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [user?.id, user?.telegram_chat_id, user?.whatsapp_phone]);

  function handleDismiss() {
    dismissedThisSession = true;
    setVisible(false);
  }

  async function handleAction(key: string) {
    setVisible(false);
    dismissedThisSession = true;

    if (key === 'pin') {
      router.push('/pin-setup');
    } else if (key === 'telegram') {
      try {
        setLinkingTelegram(true);
        const token = await generateTelegramLinkToken(user!.id);
        const url = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`;
        await Linking.openURL(url);
      } catch {
        useToastStore.getState().showToast('Could not open Telegram link', 'error');
      } finally {
        setLinkingTelegram(false);
      }
    } else if (key === 'whatsapp') {
      const msg = encodeURIComponent('Hi, I want to link my Dwella account');
      await Linking.openURL(`https://wa.me/${WHATSAPP_BOT_PHONE}?text=${msg}`);
    }
  }

  if (!visible || items.length === 0) return null;

  return (
    <Portal>
      <Modal
        visible={true}
        dismissable
        onDismiss={handleDismiss}
        contentContainerStyle={styles.container}
      >
        <Surface style={[styles.surface, { backgroundColor: colors.surface }]} elevation={4}>
          <Text variant="titleLarge" style={[styles.title, { color: colors.textPrimary }]}>
            Complete Your Setup
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
            A few quick steps to get the most out of Dwella.
          </Text>

          <View style={styles.itemList}>
            {items.map((item) => (
              <View key={item.key} style={[styles.item, { backgroundColor: colors.surfaceElevated }]}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
                  <MaterialCommunityIcons
                    name={item.icon as any}
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.itemText}>
                  <Text variant="titleSmall" style={{ color: colors.textPrimary }}>
                    {item.title}
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                    {item.description}
                  </Text>
                </View>
                <Button
                  mode="text"
                  compact
                  onPress={() => handleAction(item.key)}
                  textColor={colors.primary}
                >
                  Set up
                </Button>
              </View>
            ))}
          </View>

          <Button
            mode="text"
            onPress={handleDismiss}
            textColor={colors.textSecondary}
            style={styles.laterBtn}
          >
            Maybe Later
          </Button>
        </Surface>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 20,
  },
  surface: {
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  title: {
    fontWeight: '700',
  },
  itemList: {
    gap: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  laterBtn: {
    alignSelf: 'center',
  },
});
