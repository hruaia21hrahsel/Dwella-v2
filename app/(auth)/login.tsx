import { useState } from 'react';
import {
  View, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity, TextInput as RNTextInput,
} from 'react-native';
import { Text, TextInput, HelperText } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { DwellaLogo } from '@/components/DwellaLogo';
import { GradientButton } from '@/components/GradientButton';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';
import { isPinSet } from '@/lib/biometric-auth';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';

type AuthMode = 'email' | 'phone';

export default function LoginScreen() {
  const router = useRouter();
  const setLocked = useAuthStore((s) => s.setLocked);
  const { colors, gradients } = useTheme();

  const [mode, setMode] = useState<AuthMode>('email');

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Phone state
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [socialLoading, setSocialLoading] = useState(false);

  function switchMode(m: AuthMode) {
    setMode(m);
    setError('');
  }

  async function handleEmailLogin() {
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setLocked(false);
    const pinSet = await isPinSet(data.session!.user.id);
    if (!pinSet && data.session) {
      router.replace('/pin-setup');
      return;
    }
    setLoading(false);
  }

  async function handlePhoneLogin() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setLoading(true);
    setError('');

    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: `+91${digits}`,
    });

    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push(`/(auth)/phone-verify?phone=%2B91${digits}`);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.heroCircle, styles.heroCircle1]} />
        <View style={[styles.heroCircle, styles.heroCircle2]} />
        <View style={styles.heroContent}>
          <DwellaLogo size={90} color="#fff" />
          <Text style={styles.heroTitle}>Welcome back</Text>
          <Text style={styles.heroSubtitle}>Sign in to manage your properties</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={[styles.cardScroll, { backgroundColor: colors.surface }]}
        contentContainerStyle={styles.cardContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>

          {/* Tab toggle */}
          <View style={[styles.tabRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tab, mode === 'email' && { backgroundColor: colors.surface }]}
              onPress={() => switchMode('email')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, { color: mode === 'email' ? colors.primary : colors.textDisabled }]}>
                Email
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'phone' && { backgroundColor: colors.surface }]}
              onPress={() => switchMode('phone')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, { color: mode === 'phone' ? colors.primary : colors.textDisabled }]}>
                Phone
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'email' ? (
            <>
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                left={<TextInput.Icon icon="email-outline" />}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                mode="outlined"
                style={{ backgroundColor: colors.surface }}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                outlineStyle={styles.inputOutline}
              />

              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                left={<TextInput.Icon icon="lock-outline" />}
                secureTextEntry={!showPassword}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    onPress={() => setShowPassword((v) => !v)}
                  />
                }
                mode="outlined"
                style={{ backgroundColor: colors.surface }}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                outlineStyle={styles.inputOutline}
              />
            </>
          ) : (
            /* Phone number input */
            <View style={[styles.phoneRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={styles.phonePrefix}>
                <Text style={[styles.flagText]}>🇮🇳</Text>
                <Text style={[styles.dialCode, { color: colors.textPrimary }]}>+91</Text>
              </View>
              <View style={[styles.phoneDivider, { backgroundColor: colors.border }]} />
              <RNTextInput
                style={[styles.phoneInput, { color: colors.textPrimary }]}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                maxLength={10}
                placeholder="98765 43210"
                placeholderTextColor={colors.textDisabled}
                returnKeyType="done"
                onSubmitEditing={handlePhoneLogin}
              />
            </View>
          )}

          {!!error && (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          )}

          <GradientButton
            title={mode === 'email' ? 'Sign In' : 'Send OTP'}
            onPress={mode === 'email' ? handleEmailLogin : handlePhoneLogin}
            loading={loading}
            disabled={loading}
            style={{ marginTop: 4 }}
          />

          {mode === 'email' && (
            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => router.push('/(auth)/forgot-password')}
              activeOpacity={0.7}
            >
              <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textDisabled }]}>or continue with</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <SocialAuthButtons
            onError={setError}
            onLoading={setSocialLoading}
            disabled={loading || socialLoading}
          />

          <View style={styles.footer}>
            <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
              Don't have an account?{' '}
            </Text>
            <Link href="/(auth)/signup" asChild>
              <Text variant="bodyMedium" style={{ color: colors.primary, fontWeight: '700' }}>Sign Up</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    height: '38%',
    justifyContent: 'flex-end',
    paddingBottom: 48,
    paddingHorizontal: 32,
    overflow: 'hidden',
  },
  heroCircle: {
    position: 'absolute', borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroCircle1: { width: 260, height: 260, top: -60, right: -80 },
  heroCircle2: { width: 180, height: 180, bottom: 20, left: -60 },
  heroContent: { gap: 6 },
  heroTitle: {
    fontSize: 28, fontWeight: '800', color: '#fff',
    marginTop: 16, letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.2,
  },
  cardScroll: {
    flex: 1, borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -28,
  },
  cardContent: { flexGrow: 1 },
  card: { padding: 28, paddingTop: 32, gap: 14 },

  // Tab
  tabRow: {
    flexDirection: 'row', borderRadius: 12, borderWidth: 1,
    padding: 3, gap: 2,
  },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  tabText: { fontSize: 14, fontWeight: '700' },

  // Inputs
  inputOutline: { borderRadius: 14, borderWidth: 1.5 },

  // Phone row
  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1.5, height: 56, overflow: 'hidden',
  },
  phonePrefix: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14,
  },
  flagText: { fontSize: 18 },
  dialCode: { fontSize: 15, fontWeight: '700' },
  phoneDivider: { width: 1, height: 28 },
  phoneInput: {
    flex: 1, fontSize: 16, paddingHorizontal: 14, height: '100%',
  },

  forgotRow: { alignItems: 'center', marginTop: -4 },
  forgotText: { fontWeight: '600', fontSize: 13 },

  dividerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: {
    fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
});
