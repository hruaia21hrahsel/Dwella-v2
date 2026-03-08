import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { DwellaLogo } from '@/components/DwellaLogo';
import { isPinSet } from '@/lib/biometric-auth';
import { useAuthStore } from '@/lib/store';

export default function LoginScreen() {
  const router = useRouter();
  const setLocked = useAuthStore((s) => s.setLocked);
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

    // The user authenticated with email/password — the app is now unlocked.
    // setLocked(false) prevents AuthGuard from routing back to the PIN screen.
    setLocked(false);

    // If the user has never set up a PIN, send them to the setup screen.
    const pinSet = await isPinSet();
    if (!pinSet && data.session) {
      router.replace('/pin-setup');
      return;
    }

    setLoading(false);
    // AuthGuard handles the final redirect to dashboard/onboarding.
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={Colors.gradientHero as [string, string]}
        style={styles.hero}
      >
        <DwellaLogo size={80} color="#fff" />
        <Text style={styles.heroSubtitle}>The AI that runs your rentals.</Text>
      </LinearGradient>

      <ScrollView
        style={styles.cardScroll}
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
            style={styles.input}
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
            style={styles.input}
          />

          {!!error && (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            Sign In
          </Button>

          <TouchableOpacity
            style={styles.forgotRow}
            onPress={() => router.push('/(auth)/forgot-password')}
            activeOpacity={0.7}
          >
            <Text variant="bodySmall" style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text variant="bodyMedium" style={styles.footerText}>
              Don't have an account?{' '}
            </Text>
            <Link href="/(auth)/signup" asChild>
              <Text variant="bodyMedium" style={styles.link}>Sign Up</Text>
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
    backgroundColor: Colors.primary,
  },
  hero: {
    height: '35%',
    justifyContent: 'flex-end',
    paddingBottom: 32,
    paddingHorizontal: 32,
  },
  heroSubtitle: {
    fontSize: 15,
    color: Colors.textOnGradientMuted,
  },
  cardScroll: {
    flex: 1,
    backgroundColor: Colors.surface,
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
  input: {
    backgroundColor: Colors.surface,
  },
  button: {
    marginTop: 8,
    borderRadius: 14,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  forgotRow: { alignItems: 'center', marginTop: 2 },
  forgotText: { color: Colors.primary },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  footerText: {
    color: Colors.textSecondary,
  },
  link: {
    color: Colors.primary,
    fontWeight: '600',
  },
  logo: {
    marginBottom: 12,
  },
});
