import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
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

export default function LoginScreen() {
  const router = useRouter();
  const setLocked = useAuthStore((s) => s.setLocked);
  const { colors, gradients, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);

  async function handleLogin() {
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

    const pinSet = await isPinSet();
    if (!pinSet && data.session) {
      router.replace('/pin-setup');
      return;
    }

    setLoading(false);
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
        {/* Subtle decorative circles */}
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
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            left={<TextInput.Icon icon="email-outline" />}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.surface }]}
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
            style={[styles.input, { backgroundColor: colors.surface }]}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            outlineStyle={styles.inputOutline}
          />

          {!!error && (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          )}

          <GradientButton
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
          />

          <TouchableOpacity
            style={styles.forgotRow}
            onPress={() => router.push('/(auth)/forgot-password')}
            activeOpacity={0.7}
          >
            <Text variant="bodySmall" style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
          </TouchableOpacity>

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
  container: {
    flex: 1,
  },
  hero: {
    height: '38%',
    justifyContent: 'flex-end',
    paddingBottom: 48,
    paddingHorizontal: 32,
    overflow: 'hidden',
  },
  heroCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroCircle1: {
    width: 260,
    height: 260,
    top: -60,
    right: -80,
  },
  heroCircle2: {
    width: 180,
    height: 180,
    bottom: 20,
    left: -60,
  },
  heroContent: {
    gap: 6,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginTop: 16,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.2,
  },
  cardScroll: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -28,
  },
  cardContent: {
    flexGrow: 1,
  },
  card: {
    padding: 28,
    paddingTop: 36,
    gap: 14,
  },
  input: {},
  inputOutline: {
    borderRadius: 14,
    borderWidth: 1.5,
  },
  button: {
    marginTop: 8,
  },
  forgotRow: { alignItems: 'center', marginTop: 2 },
  forgotText: { fontWeight: '600', fontSize: 13 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
});
