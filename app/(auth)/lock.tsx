import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { DwellaLogo } from '@/components/DwellaLogo';
import { verifyPin, isPinSet, isBiometricEnabled } from '@/lib/biometric-auth';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';

const DIGITS = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];

export default function LockScreen() {
  const router = useRouter();
  const setLocked = useAuthStore((s) => s.setLocked);
  const { colors, gradients, isDark } = useTheme();
  const [ready, setReady] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  const uid = useAuthStore((s) => s.session?.user?.id);

  useEffect(() => {
    (async () => {
      if (!uid) { router.replace('/(auth)/login'); return; }
      const [enabled, pinReady] = await Promise.all([isBiometricEnabled(uid), isPinSet(uid)]);
      if (!enabled || !pinReady) {
        router.replace('/(auth)/login');
        return;
      }
      setReady(true);
    })();
  }, [uid]);

  async function handlePinDigit(digit: string) {
    const newPin = pin + digit;
    setPin(newPin);
    setPinError('');

    if (newPin.length === 6) {
      const correct = await verifyPin(uid!, newPin);
      setPin('');

      if (correct) {
        setLocked(false);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 5) {
          Alert.alert(
            'Too many attempts',
            'Please sign in with your email and password.',
            [{ text: 'OK', onPress: signOutAndGoToLogin }],
          );
        } else {
          setPinError(`Incorrect PIN. ${5 - newAttempts} attempt${5 - newAttempts === 1 ? '' : 's'} remaining.`);
        }
      }
    }
  }

  async function signOutAndGoToLogin() {
    setSigningOut(true);
    await supabase.auth.signOut();
    // AuthGuard will redirect to login once session clears
  }

  function handleDelete() {
    setPin((p) => p.slice(0, -1));
    setPinError('');
  }

  function handleDigit(d: string) {
    if (!signingOut && pin.length < 6) handlePinDigit(d);
  }

  if (!ready) {
    return <View style={[styles.center, { backgroundColor: colors.background }]} />;
  }

  return (
    <LinearGradient
      colors={isDark ? ['#0A0A0A', '#1A1A2E', '#0A0A0A'] : [colors.background, '#E0F2F1', colors.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Subtle decorative circles */}
      <View style={[styles.bgCircle, styles.bgCircle1, { backgroundColor: colors.primary + '08' }]} />
      <View style={[styles.bgCircle, styles.bgCircle2, { backgroundColor: colors.primary + '06' }]} />

      <View style={styles.pinSection}>
        <DwellaLogo size={100} color={colors.primary} />
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>Enter your PIN</Text>

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

        {!!pinError && <Text style={[styles.pinError, { color: colors.error }]}>{pinError}</Text>}

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
                    style={[styles.numpadKey, styles.numpadKeyBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', opacity: signingOut ? 0.4 : 1 }]}
                    onPress={() => handleDigit(d)}
                    disabled={signingOut}
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

      <TouchableOpacity style={styles.altLinkWrap} onPress={signOutAndGoToLogin} activeOpacity={0.7}>
        <Text style={[styles.altLink, { color: colors.primary }]}>Use email & password</Text>
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
  center: { flex: 1 },
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
  tagline: { fontSize: 16, fontWeight: '500', marginTop: -4, letterSpacing: 0.3 },
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
  pinError: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
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
  altLinkWrap: { position: 'absolute', bottom: 52 },
  altLink: { fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
});
