import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { Text, TextInput, Button, Avatar, Chip } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { TELEGRAM_BOT_USERNAME } from '@/constants/config';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { generateTelegramLinkToken, unlinkTelegram } from '@/lib/bot';
import { isPinSet, disablePin } from '@/lib/biometric-auth';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setUser, resetOnboarding } = useAuthStore();
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
            await disablePin();
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
    // Full sign-out — clears the Supabase session. AuthGuard will see
    // session = null and route to /login. The PIN screen is NOT shown
    // after logout because there is no session to unlock.
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
      {/* Avatar gradient header */}
      <LinearGradient
        colors={Colors.gradientHero as [string, string]}
        style={styles.avatarGradient}
      >
        <Avatar.Text
          size={72}
          label={initials}
          style={styles.avatar}
          labelStyle={{ color: Colors.primary, fontWeight: '700' }}
        />
        <Text style={styles.name}>{user?.full_name ?? 'User'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </LinearGradient>

      {/* Edit Profile section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Edit Profile</Text>
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
      </View>

      {/* Telegram Bot section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Telegram Bot</Text>
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
      </View>

      {/* Security section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Security</Text>
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
      </View>

      {/* App Tour */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Help</Text>
        <Button
          mode="outlined"
          icon="play-circle-outline"
          onPress={() => {
            resetOnboarding();
            router.push('/onboarding');
          }}
          style={styles.pinBtn}
        >
          Replay App Tour
        </Button>
      </View>

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
    paddingBottom: 32,
    gap: 0,
  },
  avatarGradient: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textOnGradient,
  },
  email: {
    fontSize: 14,
    color: Colors.textOnGradientMuted,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    gap: 10,
    shadowColor: '#134E4A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  input: {
    backgroundColor: Colors.surface,
  },
  saveButton: {
    marginTop: 4,
  },
  logoutButton: {
    borderColor: Colors.error,
    marginTop: 4,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  telegramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telegramLabel: { color: Colors.textPrimary },
  telegramHint: { color: Colors.textSecondary, fontSize: 13 },
  chipLinked: { backgroundColor: Colors.statusConfirmedSoft },
  chipUnlinked: { backgroundColor: Colors.border },
  telegramBtn: { marginTop: 4 },
  pinBtn: { marginTop: 4 },
});
