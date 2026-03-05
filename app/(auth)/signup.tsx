import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { savePinSession } from '@/lib/biometric-auth';

export default function SignupScreen() {
  const router = useRouter();
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

    // Auto-sign in immediately — email is auto-confirmed via DB trigger
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setError('Account created! Please sign in.');
      setLoading(false);
      return;
    }

    // Offer PIN setup after signup
    if (data.session?.refresh_token) {
      await savePinSession(data.session.refresh_token);
      router.replace('/pin-setup');
      return;
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
          <Text variant="headlineMedium" style={styles.title}>Create Account</Text>
          <Text variant="bodyLarge" style={styles.subtitle}>Start managing your properties</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            autoComplete="name"
            mode="outlined"
            style={styles.input}
          />

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
            label="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
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
            onPress={handleSignup}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            Create Account
          </Button>

          <View style={styles.footer}>
            <Text variant="bodyMedium" style={styles.footerText}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <Text variant="bodyMedium" style={styles.link}>Sign In</Text>
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
    marginBottom: 40,
  },
  title: {
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
