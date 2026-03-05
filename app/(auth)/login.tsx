import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { isBiometricEnabled, savePinSession, isPinSet } from '@/lib/biometric-auth';

export default function LoginScreen() {
  const router = useRouter();
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

    // Offer PIN setup on first login
    if (data.session?.refresh_token) {
      const [alreadyEnabled, pinSet] = await Promise.all([isBiometricEnabled(), isPinSet()]);
      if (!alreadyEnabled || !pinSet) {
        await savePinSession(data.session.refresh_token);
        router.replace('/pin-setup');
        return;
      }
    }

    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text variant="displaySmall" style={styles.logo}>Dwella</Text>
          <Text variant="bodyLarge" style={styles.subtitle}>Manage your rentals with ease</Text>
        </View>

        <View style={styles.form}>
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
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    color: Colors.primary,
    fontWeight: '700',
  },
  subtitle: {
    color: Colors.textSecondary,
    marginTop: 8,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: Colors.surface,
  },
  button: {
    marginTop: 8,
  },
  buttonContent: {
    paddingVertical: 6,
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
});
