import { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { isPinSet, savePinSession } from '@/lib/biometric-auth';
import { useTheme } from '@/lib/theme-context';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export default function PhoneVerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const setLocked = useAuthStore((s) => s.setLocked);

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startCooldown();
    // Focus first box on mount
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  function handleChange(text: string, index: number) {
    // Handle paste of full OTP
    if (text.length === OTP_LENGTH) {
      const digits = text.split('').slice(0, OTP_LENGTH);
      setOtp(digits);
      setError('');
      inputRefs.current[OTP_LENGTH - 1]?.focus();
      verifyOtp(digits.join(''));
      return;
    }

    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setError('');

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    const filled = next.join('');
    if (filled.length === OTP_LENGTH) {
      verifyOtp(filled);
    }
  }

  function handleKeyPress(e: any, index: number) {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function verifyOtp(code: string) {
    if (!phone || code.length !== OTP_LENGTH) return;
    setLoading(true);
    setError('');

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: 'sms',
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
      return;
    }

    setLocked(false);

    if (data.session?.refresh_token) {
      savePinSession(data.session.refresh_token);
    }

    const pinSet = await isPinSet();
    if (!pinSet) {
      useAuthStore.getState().setPendingRoute('/pin-setup');
    }

    setLoading(false);
    // AuthGuard handles navigation
  }

  async function handleResend() {
    if (!phone || cooldown > 0) return;
    setResending(true);
    setError('');
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
    if (otpError) {
      setError(otpError.message);
    } else {
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
      startCooldown();
    }
    setResending(false);
  }

  const maskedPhone = phone ? phone.replace(/(\+\d{2})(\d+)(\d{4})/, '$1 ●●●●● $3') : '';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Back */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <MaterialCommunityIcons name="chevron-left" size={22} color={colors.textPrimary} />
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight + '30' }]}>
          <MaterialCommunityIcons name="message-text-outline" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Enter OTP</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          We sent a 6-digit code to{'\n'}
          <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{maskedPhone}</Text>
        </Text>
      </View>

      {/* OTP boxes */}
      <View style={styles.otpRow}>
        {Array(OTP_LENGTH).fill(0).map((_, i) => {
          const filled = !!otp[i];
          return (
            <TextInput
              key={i}
              ref={(r) => { inputRefs.current[i] = r; }}
              style={[
                styles.otpBox,
                {
                  borderColor: filled ? colors.primary : colors.border,
                  backgroundColor: filled ? colors.primary + '12' : colors.surface,
                  color: colors.textPrimary,
                },
                !!error && styles.otpBoxError,
                !!error && { borderColor: colors.error },
              ]}
              value={otp[i]}
              onChangeText={(t) => handleChange(t, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH} // allow paste detection
              textAlign="center"
              selectTextOnFocus
              editable={!loading}
            />
          );
        })}
      </View>

      {!!error && (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      )}

      {loading && (
        <Text style={[styles.verifyingText, { color: colors.textSecondary }]}>Verifying…</Text>
      )}

      {/* Resend */}
      <View style={styles.resendRow}>
        <Text style={[styles.resendLabel, { color: colors.textSecondary }]}>
          Didn't get it?{' '}
        </Text>
        {cooldown > 0 ? (
          <Text style={[styles.resendCooldown, { color: colors.textDisabled }]}>
            Resend in {cooldown}s
          </Text>
        ) : (
          <TouchableOpacity onPress={handleResend} disabled={resending} activeOpacity={0.7}>
            <Text style={[styles.resendLink, { color: colors.primary }]}>
              {resending ? 'Sending…' : 'Resend OTP'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', marginLeft: -6,
  },
  header: {
    marginTop: 24, marginBottom: 40, gap: 10,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title: {
    fontSize: 26, fontWeight: '800', letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14, lineHeight: 22,
  },
  otpRow: {
    flexDirection: 'row', gap: 10, justifyContent: 'center',
  },
  otpBox: {
    width: 48, height: 56, borderRadius: 12,
    borderWidth: 1.5, fontSize: 22, fontWeight: '700',
  },
  otpBoxError: {},
  errorText: {
    fontSize: 13, textAlign: 'center', marginTop: 14,
  },
  verifyingText: {
    fontSize: 13, textAlign: 'center', marginTop: 14,
  },
  resendRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 28,
  },
  resendLabel: { fontSize: 13 },
  resendLink: { fontSize: 13, fontWeight: '700' },
  resendCooldown: { fontSize: 13 },
});
