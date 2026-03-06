import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { verifyPin, isPinSet, isBiometricEnabled } from '@/lib/biometric-auth';
import { useAuthStore } from '@/lib/store';

const DIGITS = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];

export default function LockScreen() {
  const router = useRouter();
  const setLocked = useAuthStore((s) => s.setLocked);
  const [ready, setReady] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    (async () => {
      const [enabled, pinReady] = await Promise.all([isBiometricEnabled(), isPinSet()]);
      if (!enabled || !pinReady) {
        // PIN not configured — shouldn't be here, go to login
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
        // Unlock the UI. The Supabase session is already active — AuthGuard
        // will route to dashboard as soon as isLocked becomes false.
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
    // Full sign-out so the user can re-authenticate with email/password.
    // AuthGuard will redirect to /login once the session is cleared.
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
    return <View style={styles.center} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoArea}>
        <Text style={styles.appName}>Dwella</Text>
        <Text style={styles.tagline}>Enter your PIN</Text>
      </View>

      <View style={styles.dotsRow}>
        {[0,1,2,3,4,5].map((i) => (
          <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled]} />
        ))}
      </View>

      {!!pinError && <Text style={styles.pinError}>{pinError}</Text>}

      <View style={styles.numpad}>
        {DIGITS.map((row, ri) => (
          <View key={ri} style={styles.numpadRow}>
            {row.map((d, di) => {
              if (d === '') return <View key={di} style={styles.numpadKey} />;
              if (d === '⌫') return (
                <TouchableOpacity key={di} style={styles.numpadKey} onPress={handleDelete} activeOpacity={0.6}>
                  <MaterialCommunityIcons name="backspace-outline" size={26} color={Colors.textSecondary} />
                </TouchableOpacity>
              );
              return (
                <TouchableOpacity key={di} style={styles.numpadKey} onPress={() => handleDigit(d)} activeOpacity={0.6}>
                  <Text style={styles.numpadDigit}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <TouchableOpacity onPress={signOutAndGoToLogin}>
        <Text style={styles.altLink}>Use email & password</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  center: { flex: 1, backgroundColor: Colors.background },
  logoArea: { alignItems: 'center', gap: 8 },
  appName: { fontSize: 36, fontWeight: '800', color: Colors.primary, letterSpacing: -1 },
  tagline: { fontSize: 16, color: Colors.textSecondary },
  dotsRow: { flexDirection: 'row', gap: 16 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: Colors.primary, backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: Colors.primary },
  pinError: { fontSize: 13, color: Colors.statusOverdue, textAlign: 'center' },
  numpad: { width: '100%', gap: 8 },
  numpadRow: { flexDirection: 'row', justifyContent: 'space-around' },
  numpadKey: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  numpadDigit: { fontSize: 28, fontWeight: '400', color: Colors.textPrimary },
  altLink: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
});
