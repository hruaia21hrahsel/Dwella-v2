import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { Text, TextInput, Button, Avatar, Divider, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { TELEGRAM_BOT_USERNAME } from '@/constants/config';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { generateTelegramLinkToken, unlinkTelegram } from '@/lib/bot';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDate } from '@/lib/utils';
import {
  savePinSession,
  clearBiometricSession,
  clearPin,
  isPinSet,
} from '@/lib/biometric-auth';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications(user?.id);
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [linkingTelegram, setLinkingTelegram] = useState(false);
  const [unlinkingTelegram, setUnlinkingTelegram] = useState(false);

  const [pinReady, setPinReady] = useState(false);

  useEffect(() => {
    isPinSet().then(setPinReady);
  }, []);

  async function handleSetupPin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.refresh_token) await savePinSession(session.refresh_token);
    router.push('/pin-setup');
  }

  async function handleRemovePin() {
    Alert.alert(
      'Remove PIN',
      'This will disable the PIN lock screen. You can set it up again anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await clearBiometricSession();
            await clearPin();
            setPinReady(false);
          },
        },
      ]
    );
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    const { data, error } = await supabase
      .from('users')
      .update({ full_name: fullName, phone: phone || null })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      Alert.alert('Error', error.message);
    } else if (data) {
      setUser(data);
      Alert.alert('Saved', 'Profile updated successfully.');
    }

    setSaving(false);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    setLoggingOut(false);
  }

  const handleLinkTelegram = useCallback(async () => {
    if (!user) return;
    setLinkingTelegram(true);
    try {
      const token = await generateTelegramLinkToken(user.id);
      // Refresh user to persist the token state locally
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (data) setUser(data);

      const deepLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`;
      const canOpen = await Linking.canOpenURL(deepLink);
      if (canOpen) {
        await Linking.openURL(deepLink);
      } else {
        Alert.alert('Telegram not found', 'Please install Telegram, then try again.');
      }
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLinkingTelegram(false);
    }
  }, [user, setUser]);

  const handleUnlinkTelegram = useCallback(() => {
    Alert.alert(
      'Unlink Telegram',
      'Disconnect your Telegram account from Dwella?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            setUnlinkingTelegram(true);
            try {
              await unlinkTelegram(user.id);
              const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
              if (data) setUser(data);
            } catch (err) {
              Alert.alert('Error', String(err));
            } finally {
              setUnlinkingTelegram(false);
            }
          },
        },
      ]
    );
  }, [user, setUser]);

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const telegramLinked = !!user?.telegram_chat_id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarRow}>
        <Avatar.Text size={72} label={initials} style={styles.avatar} />
        <Text variant="titleLarge" style={styles.name}>{user?.full_name ?? 'User'}</Text>
        <Text variant="bodyMedium" style={styles.email}>{user?.email}</Text>
      </View>

      <Divider style={styles.divider} />

      {/* Edit Form */}
      <Text variant="titleSmall" style={styles.sectionTitle}>Edit Profile</Text>

      <TextInput
        label="Full Name"
        value={fullName}
        onChangeText={setFullName}
        mode="outlined"
        style={styles.input}
      />

      <TextInput
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        mode="outlined"
        style={styles.input}
      />

      <TextInput
        label="Email"
        value={user?.email ?? ''}
        mode="outlined"
        style={styles.input}
        disabled
      />

      <Button
        mode="contained"
        onPress={handleSave}
        loading={saving}
        disabled={saving}
        style={styles.saveButton}
      >
        Save Changes
      </Button>

      <Divider style={styles.divider} />

      {/* Telegram */}
      <Text variant="titleSmall" style={styles.sectionTitle}>Telegram Bot</Text>

      <View style={styles.telegramCard}>
        <View style={styles.telegramRow}>
          <Text variant="bodyMedium" style={styles.telegramLabel}>Status</Text>
          <Chip
            compact
            style={telegramLinked ? styles.chipLinked : styles.chipUnlinked}
            textStyle={{ color: telegramLinked ? Colors.statusConfirmed : Colors.textSecondary, fontSize: 12 }}
          >
            {telegramLinked ? 'Linked' : 'Not linked'}
          </Chip>
        </View>
        <Text variant="bodySmall" style={styles.telegramHint}>
          {telegramLinked
            ? 'You can chat with Dwella Assistant directly on Telegram.'
            : 'Link your Telegram to chat with Dwella Assistant and receive rent reminders on Telegram.'}
        </Text>
      </View>

      {telegramLinked ? (
        <Button
          mode="outlined"
          icon="link-off"
          onPress={handleUnlinkTelegram}
          loading={unlinkingTelegram}
          disabled={unlinkingTelegram}
          textColor={Colors.error}
          style={[styles.telegramBtn, { borderColor: Colors.error }]}
        >
          Unlink Telegram
        </Button>
      ) : (
        <Button
          mode="contained-tonal"
          icon="send"
          onPress={handleLinkTelegram}
          loading={linkingTelegram}
          disabled={linkingTelegram}
          style={styles.telegramBtn}
        >
          Link Telegram
        </Button>
      )}

      <Divider style={styles.divider} />

      {/* Notifications */}
      <View style={styles.notifHeader}>
        <Text variant="titleSmall" style={styles.sectionTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <Button compact mode="text" onPress={markAllRead} textColor={Colors.primary}>
            Mark all read
          </Button>
        )}
      </View>

      {notifications.length === 0 ? (
        <Text variant="bodySmall" style={styles.emptyNotif}>No notifications yet.</Text>
      ) : (
        <View style={styles.notifList}>
          {notifications.slice(0, 10).map((n) => (
            <View
              key={n.id}
              style={[styles.notifRow, !n.is_read && styles.notifUnread]}
            >
              <View style={styles.notifContent}>
                <Text variant="bodyMedium" style={[styles.notifTitle, !n.is_read && styles.notifTitleUnread]}>
                  {n.title}
                </Text>
                <Text variant="bodySmall" style={styles.notifBody}>{n.body}</Text>
                <Text variant="bodySmall" style={styles.notifTime}>{formatDate(n.created_at)}</Text>
              </View>
              {!n.is_read && (
                <Button compact mode="text" onPress={() => markRead(n.id)} textColor={Colors.textSecondary}>
                  ✓
                </Button>
              )}
            </View>
          ))}
        </View>
      )}

      <Divider style={styles.divider} />

      {/* Security */}
      <Text variant="titleSmall" style={styles.sectionTitle}>Security</Text>

      <Button
        mode="outlined"
        icon="lock-outline"
        onPress={handleSetupPin}
        style={styles.pinBtn}
      >
        {pinReady ? 'Change PIN' : 'Set Up PIN'}
      </Button>

      {pinReady && (
        <Button
          mode="text"
          icon="lock-open-outline"
          onPress={handleRemovePin}
          textColor={Colors.error}
        >
          Remove PIN
        </Button>
      )}

      <Divider style={styles.divider} />

      <Button
        mode="outlined"
        onPress={handleLogout}
        loading={loggingOut}
        disabled={loggingOut}
        textColor={Colors.error}
        style={styles.logoutButton}
      >
        Sign Out
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    gap: 12,
  },
  avatarRow: {
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  avatar: {
    backgroundColor: Colors.primary,
  },
  name: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  email: {
    color: Colors.textSecondary,
  },
  divider: {
    marginVertical: 8,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.surface,
  },
  saveButton: {
    marginTop: 8,
  },
  logoutButton: {
    borderColor: Colors.error,
    marginTop: 8,
  },
  telegramCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  telegramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telegramLabel: { color: Colors.textPrimary },
  telegramHint: { color: Colors.textSecondary },
  chipLinked: { backgroundColor: Colors.statusConfirmed + '22' },
  chipUnlinked: { backgroundColor: Colors.border },
  telegramBtn: { marginTop: 4 },
  pinBtn: { marginTop: 4 },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyNotif: { color: Colors.textSecondary },
  notifList: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  notifUnread: {
    backgroundColor: Colors.primary + '08',
  },
  notifContent: { flex: 1 },
  notifTitle: { color: Colors.textPrimary },
  notifTitleUnread: { fontWeight: '600' },
  notifBody: { color: Colors.textSecondary, marginTop: 2 },
  notifTime: { color: Colors.textDisabled, marginTop: 4, fontSize: 11 },
});
