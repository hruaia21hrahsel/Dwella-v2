import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import {
  getBiometricType,
  promptBiometric,
  getBiometricRefreshToken,
  verifyPin,
  isPinSet,
  isBiometricEnabled,
  clearBiometricSession,
  clearPin,
} from '@/lib/biometric-auth';

type Screen = 'biometric' | 'pin' | 'loading';

export default function LockScreen() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('loading');
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | 'none'>('none');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [restoring, setRestoring] = useState(false);

  const restoreSession = useCallback(async () => {
    setRestoring(true);
    const refreshToken = await getBiometricRefreshToken();
    if (!refreshToken) {
      // No stored session — fall through to email/password
      goToLogin();
      return;
    }
    const { error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error) {
      // Token expired — clear and go to login
      await clearBiometricSession();
      await clearPin();
      goToLogin();
    } else {
      router.replace('/(tabs)/dashboard');
    }
    setRestoring(false);
  }, []);

  useEffect(() => {
    (async () => {
      const enabled = await isBiometricEnabled();
      if (!enabled) { goToLogin(); return; }

      const type = await getBiometricType();
      setBiometricType(type);

      if (type !== 'none') {
        setScreen('biometric');
        triggerBiometric();
      } else {
        // No biometric hardware — go straight to PIN
        const pinReady = await isPinSet();
        setScreen(pinReady ? 'pin' : 'loading');
        if (!pinReady) goToLogin();
      }
    })();
  }, []);

  async function triggerBiometric() {
    const success = await promptBiometric();
    if (success) {
      await restoreSession();
    } else {
      // Failed — fall to PIN
      const pinReady = await isPinSet();
      setScreen(pinReady ? 'pin' : 'loading');
      if (!pinReady) goToLogin();
    }
  }

  function goToLogin() {
    router.replace('/(auth)/login');
  }

  async function handlePinDigit(digit: string) {
    const newPin = pin + digit;
    setPin(newPin);
    setPinError('');

    if (newPin.length === 6) {
      const correct = await verifyPin(newPin);
      if (correct) {
        setPin('');
        await restoreSession();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPin('');
        if (newAttempts >= 5) {
          Alert.alert(
            'Too many attempts',
            'Please sign in with your email and password.',
            [{ text: 'OK', onPress: goToLogin }],
          );
        } else {
          setPinError(`Incorrect PIN. ${5 - newAttempts} attempt${5 - newAttempts === 1 ? '' : 's'} remaining.`);
        }
      }
    }
  }

  function handleDelete() {
    setPin((p) => p.slice(0, -1));
    setPinError('');
  }

  if (screen === 'loading' || restoring) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  // ── Biometric screen ──────────────────────────────────────────────
  if (screen === 'biometric') {
    return (
      <View style={styles.container}>
        <View style={styles.logoArea}>
          <Text style={styles.appName}>Dwella</Text>
          <Text style={styles.tagline}>Welcome back</Text>
        </View>

        <TouchableOpacity style={styles.biometricBtn} onPress={triggerBiometric} activeOpacity={0.8}>
          <MaterialCommunityIcons
            name={biometricType === 'face' ? 'face-recognition' : 'fingerprint'}
            size={64}
            color={Colors.primary}
          />
          <Text style={styles.biometricLabel}>
            {biometricType === 'face' ? 'Sign in with Face ID' : 'Sign in with Fingerprint'}
          </Text>
        </TouchableOpacity>

        <View style={styles.altActions}>
          <TouchableOpacity onPress={async () => {
            const pinReady = await isPinSet();
            setScreen(pinReady ? 'pin' : 'loading');
            if (!pinReady) goToLogin();
          }}>
            <Text style={styles.altLink}>Use PIN instead</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToLogin}>
            <Text style={styles.altLink}>Use email & password</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── PIN screen ────────────────────────────────────────────────────
  const DIGITS = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];

  return (
    <View style={styles.container}>
      <View style={styles.logoArea}>
        <Text style={styles.appName}>Dwella</Text>
        <Text style={styles.tagline}>Enter your PIN</Text>
      </View>

      {/* PIN dots */}
      <View style={styles.dotsRow}>
        {[0,1,2,3,4,5].map((i) => (
          <View
            key={i}
            style={[styles.dot, pin.length > i && styles.dotFilled]}
          />
        ))}
      </View>

      {!!pinError && <Text style={styles.pinError}>{pinError}</Text>}

      {/* Numpad */}
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
                <TouchableOpacity
                  key={di}
                  style={styles.numpadKey}
                  onPress={() => handleDigit(d)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.numpadDigit}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.altActions}>
        {biometricType !== 'none' && (
          <TouchableOpacity onPress={() => { setScreen('biometric'); triggerBiometric(); }}>
            <Text style={styles.altLink}>
              Use {biometricType === 'face' ? 'Face ID' : 'Fingerprint'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={goToLogin}>
          <Text style={styles.altLink}>Use email & password</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  function handleDigit(d: string) {
    if (pin.length < 6) handlePinDigit(d);
  }
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  logoArea: { alignItems: 'center', gap: 8 },
  appName: { fontSize: 36, fontWeight: '800', color: Colors.primary, letterSpacing: -1 },
  tagline: { fontSize: 16, color: Colors.textSecondary },
  biometricBtn: { alignItems: 'center', gap: 16 },
  biometricLabel: { fontSize: 16, color: Colors.textPrimary, fontWeight: '500' },
  dotsRow: { flexDirection: 'row', gap: 16 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: Colors.primary },
  pinError: { fontSize: 13, color: Colors.statusOverdue, textAlign: 'center' },
  numpad: { width: '100%', gap: 8 },
  numpadRow: { flexDirection: 'row', justifyContent: 'space-around' },
  numpadKey: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  numpadDigit: { fontSize: 28, fontWeight: '400', color: Colors.textPrimary },
  altActions: { alignItems: 'center', gap: 16 },
  altLink: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
});
