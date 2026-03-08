import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Text, TextInput, HelperText } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { DwellaLogo } from '@/components/DwellaLogo';
import { GradientButton } from '@/components/GradientButton';
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
        <DwellaLogo size={80} color="#fff" />
        <Text style={styles.heroSubtitle}>The AI that runs your rentals.</Text>
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
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.surface }]}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword((v) => !v)}
              />
            }
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.surface }]}
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

          <View style={styles.footer}>
            <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
              Don't have an account?{' '}
            </Text>
            <Link href="/(auth)/signup" asChild>
              <Text variant="bodyMedium" style={{ color: colors.primary, fontWeight: '600' }}>Sign Up</Text>
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
    height: '35%',
    justifyContent: 'flex-end',
    paddingBottom: 32,
    paddingHorizontal: 32,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
  },
  cardScroll: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
  },
  cardContent: {
    flexGrow: 1,
  },
  card: {
    padding: 28,
    paddingTop: 32,
    gap: 12,
  },
  input: {},
  button: {
    marginTop: 8,
  },
  forgotRow: { alignItems: 'center', marginTop: 2 },
  forgotText: {},
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
});
