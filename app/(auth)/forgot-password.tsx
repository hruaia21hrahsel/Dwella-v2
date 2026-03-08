import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, HelperText } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { DwellaLogo } from '@/components/DwellaLogo';
import { GradientButton } from '@/components/GradientButton';
import { useTheme } from '@/lib/theme-context';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors, gradients, isDark } = useTheme();
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
      <LinearGradient
        colors={isDark ? ['#0A0A0A', '#1A1A2E', '#0A0A0A'] : [colors.background, '#E0F2F1', colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.sentContainer}
      >
        <View style={[styles.sentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.sentIconCircle, { backgroundColor: colors.primary + '15' }]}>
            <MaterialCommunityIcons name="email-check-outline" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.sentTitle, { color: colors.textPrimary }]}>Check your inbox</Text>
          <Text style={[styles.sentBody, { color: colors.textSecondary }]}>
            A password reset link has been sent to{'\n'}
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{email}</Text>
          </Text>
          <GradientButton
            title="Back to Sign In"
            onPress={() => router.back()}
            style={{ alignSelf: 'stretch', marginTop: 8 }}
          />
        </View>
      </LinearGradient>
    );
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
          <View style={styles.heroIconCircle}>
            <MaterialCommunityIcons name="lock-reset" size={36} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Forgot Password?</Text>
          <Text style={styles.heroSubtitle}>No worries, we'll send you a reset link</Text>
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
            onChangeText={(v) => { setEmail(v); setError(''); }}
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

          {!!error && <HelperText type="error" visible>{error}</HelperText>}

          <GradientButton
            title="Send Reset Link"
            onPress={handleReset}
            loading={loading}
            disabled={loading}
            style={{ marginTop: 8 }}
          />

          <View style={styles.backRow}>
            <MaterialCommunityIcons name="arrow-left" size={16} color={colors.textSecondary} />
            <Text
              style={[styles.backText, { color: colors.textSecondary }]}
              onPress={() => router.back()}
            >
              Back to Sign In
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    height: '32%',
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
    width: 200,
    height: 200,
    top: -40,
    right: -60,
  },
  heroCircle2: {
    width: 140,
    height: 140,
    bottom: 20,
    left: -40,
  },
  heroContent: {
    gap: 6,
  },
  heroIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
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
    paddingTop: 36,
    gap: 14,
  },
  inputOutline: {
    borderRadius: 14,
    borderWidth: 1.5,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Sent state
  sentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  sentCard: {
    width: '100%',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  sentIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sentTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  sentBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
});
