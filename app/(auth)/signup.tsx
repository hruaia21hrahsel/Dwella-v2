import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, HelperText } from 'react-native-paper';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { savePinSession } from '@/lib/biometric-auth';
import { GradientButton } from '@/components/GradientButton';
import { useTheme } from '@/lib/theme-context';

export default function SignupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text variant="headlineMedium" style={[styles.title, { color: colors.primary }]}>Create Account</Text>
          <Text variant="bodyLarge" style={{ color: colors.textSecondary, marginTop: 8 }}>Start managing your properties</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            autoComplete="name"
            mode="outlined"
            style={{ backgroundColor: colors.surface }}
          />

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            mode="outlined"
            style={{ backgroundColor: colors.surface }}
          />

          <TextInput
            label="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            mode="outlined"
            style={{ backgroundColor: colors.surface }}
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
            style={{ backgroundColor: colors.surface }}
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

          <View style={styles.footer}>
            <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <Text variant="bodyMedium" style={{ color: colors.primary, fontWeight: '600' }}>Sign In</Text>
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
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontWeight: '700',
  },
  form: {
    gap: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
});
