import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text } from 'react-native-paper';
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
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    (async () => {
      const [enabled, pinReady] = await Promise.all([isBiometricEnabled(), isPinSet()]);
      if (!enabled || !pinReady) {
        router.replace('/(auth)/login');
        return;
      }
      setReady(true);
    })();
  }, []);

  async function handlePinDigit(digit: string) {
    const newPin = pin + digit;
    setPin(newPin);
    setPinError('');

    if (newPin.length === 6) {
      const correct = await verifyPin(newPin);
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
    await supabase.auth.signOut();
  }

  function handleDelete() {
    setPin((p) => p.slice(0, -1));
    setPinError('');
  }

  function handleDigit(d: string) {
    if (pin.length < 6) handlePinDigit(d);
  }

  if (!ready) {
    return <View style={[styles.center, { backgroundColor: colors.background }]} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.pinSection}>
        <DwellaLogo size={120} color={colors.textPrimary} />
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>Enter your PIN</Text>

        <View style={styles.dotsRow}>
          {[0,1,2,3,4,5].map((i) => (
            <View key={i} style={[styles.dot, { borderColor: colors.primary }, pin.length > i && { backgroundColor: colors.primary }]} />
          ))}
        </View>

        {!!pinError && <Text style={[styles.pinError, { color: colors.error }]}>{pinError}</Text>}

        <View style={styles.numpad}>
          {DIGITS.map((row, ri) => (
            <View key={ri} style={styles.numpadRow}>
              {row.map((d, di) => {
                if (d === '') return <View key={di} style={styles.numpadKey} />;
                if (d === '⌫') return (
                  <TouchableOpacity key={di} style={[styles.numpadKey, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleDelete} activeOpacity={0.6}>
                    <MaterialCommunityIcons name="backspace-outline" size={26} color={colors.textSecondary} />
                  </TouchableOpacity>
                );
                return (
                  <TouchableOpacity key={di} style={[styles.numpadKey, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => handleDigit(d)} activeOpacity={0.6}>
                    <Text style={[styles.numpadDigit, { color: colors.textPrimary }]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.altLinkWrap} onPress={signOutAndGoToLogin}>
        <Text style={[styles.altLink, { color: colors.primary }]}>Use email & password</Text>
      </TouchableOpacity>
    </View>
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
  pinSection: {
    alignItems: 'center',
    width: '100%',
    gap: 24,
  },
  tagline: { fontSize: 16, marginTop: -4 },
  dotsRow: { flexDirection: 'row', gap: 16 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, backgroundColor: 'transparent',
  },
  pinError: { fontSize: 13, textAlign: 'center' },
  numpad: { width: '100%', gap: 8 },
  numpadRow: { flexDirection: 'row', justifyContent: 'space-around' },
  numpadKey: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  numpadDigit: { fontSize: 28, fontWeight: '400' },
  altLinkWrap: { position: 'absolute', bottom: 52 },
  altLink: { fontSize: 14, fontWeight: '500' },
});
