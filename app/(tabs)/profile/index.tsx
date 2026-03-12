import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Text, TextInput, Button, Chip } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { TELEGRAM_BOT_USERNAME } from '@/constants/config';
import { useAuthStore } from '@/lib/store';
import { useToastStore } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { generateTelegramLinkToken, unlinkTelegram } from '@/lib/bot';
import { isPinSet, disablePin } from '@/lib/biometric-auth';
import { useTheme, useThemeToggle } from '@/lib/theme-context';
import { GlassCard } from '@/components/GlassCard';
import { GradientButton } from '@/components/GradientButton';
import type { ThemeMode } from '@/lib/store';
import { DwellaHeader } from '@/components/DwellaHeader';

const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, gradients, shadows, isDark } = useTheme();
  const { mode: themeMode, setMode: setThemeMode } = useThemeToggle();
  const { user, setUser, resetOnboarding } = useAuthStore();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [linkingTelegram, setLinkingTelegram] = useState(false);
  const [unlinkingTelegram, setUnlinkingTelegram] = useState(false);

  const [pinReady, setPinReady] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useFocusEffect(
    useCallback(() => {
      isPinSet().then(setPinReady);
    }, [])
  );

  async function handlePhotoPress() {
    const hasPhoto = !!user?.avatar_url;
    const options = hasPhoto
      ? ['Change Photo', 'Delete Photo', 'Cancel']
      : ['Upload Photo', 'Cancel'];
    const destructiveIndex = hasPhoto ? 1 : -1;
    const cancelIndex = options.length - 1;

    Alert.alert('Profile Photo', undefined, [
      {
        text: hasPhoto ? 'Change Photo' : 'Upload Photo',
        onPress: pickAndUploadPhoto,
      },
      ...(hasPhoto ? [{
        text: 'Delete Photo',
        style: 'destructive' as const,
        onPress: deletePhoto,
      }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  async function pickAndUploadPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library in Settings.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0] || !user) return;

    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, {
          contentType: asset.mimeType ?? 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      // Bust cache with timestamp
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { data, error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;
      if (data) setUser(data);

      useToastStore.getState().showToast('Profile photo updated.', 'success');
    } catch (err) {
      useToastStore.getState().showToast(String(err), 'error');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function deletePhoto() {
    if (!user?.avatar_url || !user) return;
    setUploadingPhoto(true);
    try {
      // Extract the storage path from the URL
      const url = new URL(user.avatar_url);
      const pathMatch = url.pathname.match(/avatars\/(.+?)(\?|$)/);
      if (pathMatch) {
        await supabase.storage.from('avatars').remove([pathMatch[1]]);
      }

      const { data, error } = await supabase
        .from('users')
        .update({ avatar_url: null })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      if (data) setUser(data);

      useToastStore.getState().showToast('Profile photo removed.', 'success');
    } catch (err) {
      useToastStore.getState().showToast(String(err), 'error');
    } finally {
      setUploadingPhoto(false);
    }
  }

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
      useToastStore.getState().showToast(error.message, 'error');
    } else if (data) {
      setUser(data);
      useToastStore.getState().showToast('Profile updated successfully.', 'success');
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
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (data) setUser(data);

      const deepLink = `tg://resolve?domain=${TELEGRAM_BOT_USERNAME}&start=${token}`;
      const canOpen = await Linking.canOpenURL(deepLink);
      if (canOpen) {
        await Linking.openURL(deepLink);
      } else {
        useToastStore.getState().showToast('Please install Telegram, then try again.', 'error');
      }
    } catch (err) {
      useToastStore.getState().showToast(String(err), 'error');
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
              useToastStore.getState().showToast(String(err), 'error');
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
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <DwellaHeader />
      {/* Avatar gradient header */}
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.avatarGradient}
      >
        <TouchableOpacity onPress={handlePhotoPress} activeOpacity={0.8} style={styles.avatarWrap}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatarPhoto} />
          ) : (
            <View style={styles.avatar}>
              <Text style={[styles.avatarLabel, { color: colors.primary }]}>{initials}</Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            {uploadingPhoto
              ? <ActivityIndicator size={12} color="#fff" />
              : <MaterialCommunityIcons name="camera" size={14} color="#fff" />
            }
          </View>
        </TouchableOpacity>
        <Text style={styles.name}>{user?.full_name ?? 'User'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </LinearGradient>

      {/* Edit Profile section */}
      <GlassCard style={[styles.sectionCard, { marginTop: 0 }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Edit Profile</Text>
        <TextInput
          label="Full Name"
          value={fullName}
          onChangeText={setFullName}
          mode="outlined"
          style={{ backgroundColor: colors.surface }}
        />
        <TextInput
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          mode="outlined"
          style={{ backgroundColor: colors.surface }}
        />
        <TextInput
          label="Email"
          value={user?.email ?? ''}
          mode="outlined"
          style={{ backgroundColor: colors.surface }}
          disabled
        />
        <GradientButton
          title="Save Changes"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={{ marginTop: 4 }}
        />
      </GlassCard>

      {/* Telegram Bot section */}
      <GlassCard style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Telegram Bot</Text>
        <View style={styles.telegramRow}>
          <Text variant="bodyMedium" style={{ color: colors.textPrimary }}>Status</Text>
          <Chip
            compact
            style={{ backgroundColor: telegramLinked ? colors.statusConfirmedSoft : colors.border }}
            textStyle={{ color: telegramLinked ? colors.statusConfirmed : colors.textSecondary, fontSize: 12 }}
          >
            {telegramLinked ? 'Linked' : 'Not linked'}
          </Chip>
        </View>
        <Text variant="bodySmall" style={{ color: colors.textSecondary, fontSize: 13 }}>
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
            textColor={colors.error}
            style={{ marginTop: 4, borderColor: colors.error }}
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
            style={{ marginTop: 4 }}
          >
            Link Telegram
          </Button>
        )}
      </GlassCard>

      {/* Security section */}
      <GlassCard style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Security</Text>
        <Button
          mode="outlined"
          icon="lock-outline"
          onPress={handleSetupPin}
          style={{ marginTop: 4 }}
        >
          {pinReady ? 'Change PIN' : 'Set Up PIN'}
        </Button>
        {pinReady && (
          <Button
            mode="text"
            icon="lock-open-outline"
            onPress={handleRemovePin}
            textColor={colors.error}
          >
            Remove PIN
          </Button>
        )}
      </GlassCard>

      {/* Appearance section */}
      <GlassCard style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
        <View style={styles.themePills}>
          {THEME_OPTIONS.map((opt) => {
            const active = themeMode === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.themePill,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  active && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                ]}
                onPress={() => setThemeMode(opt.value)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.themePillText,
                  { color: colors.textSecondary },
                  active && { color: colors.primary, fontWeight: '700' },
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </GlassCard>

      {/* Help section */}
      <GlassCard style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Help</Text>
        <Button
          mode="outlined"
          icon="play-circle-outline"
          onPress={() => {
            resetOnboarding();
            router.push('/onboarding');
          }}
          style={{ marginTop: 4 }}
        >
          Replay App Tour
        </Button>
      </GlassCard>

      <Button
        mode="outlined"
        onPress={handleLogout}
        loading={loggingOut}
        disabled={loggingOut}
        textColor={colors.error}
        style={[styles.logoutButton, { borderColor: colors.error }]}
      >
        Sign Out
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarLabel: {
    fontSize: 28,
    fontWeight: '700',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  email: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
  },
  sectionCard: {
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  logoutButton: {
    marginTop: 4,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  telegramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Theme pills
  themePills: {
    flexDirection: 'row',
    gap: 10,
  },
  themePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  themePillText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
