import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { savePin } from '@/lib/biometric-auth';
import { useAuthStore } from '@/lib/store';
import { useToastStore } from '@/lib/toast';
import { useTheme } from '@/lib/theme-context';
import { DwellaLogo } from '@/components/DwellaLogo';
import { useTrack, EVENTS } from '@/lib/analytics';

type Step = 'enter' | 'confirm';

const DIGITS = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];

export default function PinSetupScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const track = useTrack();
  const [step, setStep] = useState<Step>('enter');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');

  function finish() {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      const { onboardingCompletedByUser, user } = useAuthStore.getState();
      const onboardingCompleted = onboardingCompletedByUser[user?.id ?? ''] ?? false;
      router.replace(onboardingCompleted ? '/(tabs)/dashboard' : '/onboarding');
    }
  }

  async function handleDigit(d: string) {
    if (pin.length >= 6) return;
    const newPin = pin + d;
    setPin(newPin);
    setError('');

    if (newPin.length === 6) {
      if (step === 'enter') {
        setFirstPin(newPin);
        setPin('');
        setStep('confirm');
      } else {
        if (newPin === firstPin) {
          const uid = useAuthStore.getState().session?.user?.id;
          if (!uid) return;
          await savePin(uid, newPin);
          useAuthStore.getState().setLocked(false);
          track(EVENTS.PIN_SETUP_COMPLETED, { biometric_type: 'pin_only' });
          useToastStore.getState().showToast('PIN set up successfully!', 'success');
          finish();
        } else {
          setError('PINs do not match. Try again.');
          setPin('');
          setStep('enter');
          setFirstPin('');
        }
      }
    }
  }

  function handleDelete() {
    setPin((p) => p.slice(0, -1));
    setError('');
  }

  function handleSkip() {
    finish();
  }

  return (
    <LinearGradient
      colors={isDark ? ['#0A0A0A', '#1A1A2E', '#0A0A0A'] : [colors.background, '#E0F2F1', colors.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Decorative circles */}
      <View style={[styles.bgCircle, styles.bgCircle1, { backgroundColor: colors.primary + '08' }]} />
      <View style={[styles.bgCircle, styles.bgCircle2, { backgroundColor: colors.primary + '06' }]} />

      <View style={styles.pinSection}>
        <DwellaLogo size={100} color={colors.primary} />

        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {step === 'enter' ? 'Set a 6-digit PIN' : 'Confirm your PIN'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {step === 'enter'
              ? 'This PIN will be used as a backup to biometric sign-in.'
              : 'Enter the same PIN again to confirm.'}
          </Text>
        </View>

        <View style={styles.dotsRow}>
          {[0,1,2,3,4,5].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { borderColor: colors.primary + '60' },
                pin.length > i && styles.dotFilled,
                pin.length > i && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              {pin.length > i && (
                <View style={[styles.dotGlow, { backgroundColor: colors.primary + '30' }]} />
              )}
            </View>
          ))}
        </View>

        {!!error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

        <View style={styles.numpad}>
          {DIGITS.map((row, ri) => (
            <View key={ri} style={styles.numpadRow}>
              {row.map((d, di) => {
                if (d === '') return <View key={di} style={styles.numpadKey} />;
                if (d === '⌫') return (
                  <TouchableOpacity
                    key={di}
                    style={[styles.numpadKey, styles.numpadKeyBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
                    onPress={handleDelete}
                    activeOpacity={0.5}
                  >
                    <MaterialCommunityIcons name="backspace-outline" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                );
                return (
                  <TouchableOpacity
                    key={di}
                    style={[styles.numpadKey, styles.numpadKeyBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
                    onPress={() => handleDigit(d)}
                    activeOpacity={0.5}
                  >
                    <Text style={[styles.numpadDigit, { color: colors.textPrimary }]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.skipWrap} onPress={handleSkip} activeOpacity={0.7}>
        <Text style={[styles.skipLink, { color: colors.primary }]}>Skip for now</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  bgCircle1: {
    width: 300,
    height: 300,
    top: -80,
    right: -100,
  },
  bgCircle2: {
    width: 220,
    height: 220,
    bottom: 40,
    left: -80,
  },
  pinSection: {
    alignItems: 'center',
    width: '100%',
    gap: 20,
  },
  textBlock: {
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  dotsRow: { flexDirection: 'row', gap: 18, marginVertical: 4 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFilled: {
    transform: [{ scale: 1.15 }],
  },
  dotGlow: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  error: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
  numpad: { width: '100%', gap: 10, marginTop: 8 },
  numpadRow: { flexDirection: 'row', justifyContent: 'space-around' },
  numpadKey: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numpadKeyBg: {
    borderWidth: 1,
  },
  numpadDigit: { fontSize: 28, fontWeight: '500' },
  skipWrap: { position: 'absolute', bottom: 52 },
  skipLink: { fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
});
