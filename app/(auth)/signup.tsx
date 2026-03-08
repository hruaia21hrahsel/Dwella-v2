import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, HelperText } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { savePinSession } from '@/lib/biometric-auth';
import { DwellaLogo } from '@/components/DwellaLogo';
import { GradientButton } from '@/components/GradientButton';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';
import { useTheme } from '@/lib/theme-context';

export default function SignupScreen() {
  const router = useRouter();
  const { colors, gradients } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);

  async function handleSignup() {
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Full name, email, and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');

    const { error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), phone: phone.trim() || null } },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setError('Account created! Please sign in.');
      setLoading(false);
      return;
    }

    if (data.session?.refresh_token) {
      await savePinSession(data.session.refresh_token);
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
        {/* Decorative circles */}
        <View style={[styles.heroCircle, styles.heroCircle1]} />
        <View style={[styles.heroCircle, styles.heroCircle2]} />

        <View style={styles.heroContent}>
          <DwellaLogo size={72} color="#fff" />
          <Text style={styles.heroTitle}>Create Account</Text>
          <Text style={styles.heroSubtitle}>Start managing your properties</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={[styles.cardScroll, { backgroundColor: colors.surface }]}
        contentContainerStyle={styles.cardContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <TextInput
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            left={<TextInput.Icon icon="account-outline" />}
            autoComplete="name"
            mode="outlined"
            style={{ backgroundColor: colors.surface }}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            outlineStyle={styles.inputOutline}
          />

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
            label="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            left={<TextInput.Icon icon="phone-outline" />}
            keyboardType="phone-pad"
            autoComplete="tel"
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

          {!!error && (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          )}

          <GradientButton
            title="Create Account"
            onPress={handleSignup}
            loading={loading}
            disabled={loading}
            style={{ marginTop: 8 }}
          />

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textDisabled }]}>or sign up with</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <SocialAuthButtons
            onError={setError}
            onLoading={setSocialLoading}
            disabled={loading || socialLoading}
          />

          <View style={styles.footer}>
            <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <Text variant="bodyMedium" style={{ color: colors.primary, fontWeight: '700' }}>Sign In</Text>
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
    height: '30%',
    justifyContent: 'flex-end',
    paddingBottom: 44,
    paddingHorizontal: 32,
    overflow: 'hidden',
  },
  heroCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroCircle1: {
    width: 220,
    height: 220,
    top: -50,
    right: -60,
  },
  heroCircle2: {
    width: 150,
    height: 150,
    bottom: 10,
    left: -40,
  },
  heroContent: {
    gap: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginTop: 12,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
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
    paddingTop: 32,
    gap: 12,
  },
  inputOutline: {
    borderRadius: 14,
    borderWidth: 1.5,
  },
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
