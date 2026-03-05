import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
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
      <View style={styles.container}>
        <View style={styles.sentBox}>
          <Text style={styles.sentIcon}>📬</Text>
          <Text style={styles.sentTitle}>Check your inbox</Text>
          <Text style={styles.sentBody}>
            A password reset link has been sent to{'\n'}
            <Text style={styles.sentEmail}>{email}</Text>
          </Text>
          <Button
            mode="contained"
            onPress={() => router.back()}
            style={styles.button}
            buttonColor={Colors.primary}
          >
            Back to Sign In
          </Button>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Forgot Password?</Text>
        <Text style={styles.subtitle}>
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
          style={styles.input}
          outlineColor={Colors.border}
          activeOutlineColor={Colors.primary}
        />

        {!!error && <HelperText type="error" visible>{error}</HelperText>}

        <Button
          mode="contained"
          onPress={handleReset}
          loading={loading}
          disabled={loading}
          style={styles.button}
          buttonColor={Colors.primary}
          contentStyle={styles.buttonContent}
        >
          Send Reset Link
        </Button>

        <Button
          mode="text"
          onPress={() => router.back()}
          textColor={Colors.textSecondary}
          style={{ marginTop: 4 }}
        >
          Back to Sign In
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  input: { backgroundColor: Colors.surface },
  button: { marginTop: 4 },
  buttonContent: { paddingVertical: 6 },
  // Sent state
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
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  sentBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  sentEmail: { color: Colors.primary, fontWeight: '600' },
});
