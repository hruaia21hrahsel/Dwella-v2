import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { GradientButton } from '@/components/GradientButton';
import { useTheme } from '@/lib/theme-context';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim());

    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.sentBox}>
          <Text style={styles.sentIcon}>📬</Text>
          <Text style={[styles.sentTitle, { color: colors.textPrimary }]}>Check your inbox</Text>
          <Text style={[styles.sentBody, { color: colors.textSecondary }]}>
            A password reset link has been sent to{'\n'}
            <Text style={{ color: colors.primary, fontWeight: '600' }}>{email}</Text>
          </Text>
          <GradientButton
            title="Back to Sign In"
            onPress={() => router.back()}
            style={{ marginTop: 4, alignSelf: 'stretch' }}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Forgot Password?</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter your email and we'll send you a link to reset your password.
        </Text>

        <TextInput
          label="Email"
          value={email}
          onChangeText={(v) => { setEmail(v); setError(''); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          mode="outlined"
          style={{ backgroundColor: colors.surface }}
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
        />

        {!!error && <HelperText type="error" visible>{error}</HelperText>}

        <GradientButton
          title="Send Reset Link"
          onPress={handleReset}
          loading={loading}
          disabled={loading}
          style={{ marginTop: 4 }}
        />

        <Button
          mode="text"
          onPress={() => router.back()}
          textColor={colors.textSecondary}
          style={{ marginTop: 4 }}
        >
          Back to Sign In
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  sentBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  sentIcon: { fontSize: 48, marginBottom: 8 },
  sentTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  sentBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
});
