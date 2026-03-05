import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter, useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { savePin } from '@/lib/biometric-auth';
import { Colors } from '@/constants/colors';

type Step = 'enter' | 'confirm';

export default function PinSetupScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [step, setStep] = useState<Step>('enter');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');

  function finish() {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/dashboard');
    }
  }

  const DIGITS = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];

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
          await savePin(newPin);
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {step === 'enter' ? 'Set a 6-digit PIN' : 'Confirm your PIN'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'enter'
            ? 'This PIN will be used as a backup to biometric sign-in.'
            : 'Enter the same PIN again to confirm.'}
        </Text>
      </View>

      <View style={styles.dotsRow}>
        {[0,1,2,3,4,5].map((i) => (
          <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled]} />
        ))}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

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

      <TouchableOpacity onPress={handleSkip}>
        <Text style={styles.skipLink}>Skip for now</Text>
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
  header: { alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  dotsRow: { flexDirection: 'row', gap: 16 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: Colors.primary, backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: Colors.primary },
  error: { fontSize: 13, color: Colors.statusOverdue, textAlign: 'center' },
  numpad: { width: '100%', gap: 8 },
  numpadRow: { flexDirection: 'row', justifyContent: 'space-around' },
  numpadKey: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  numpadDigit: { fontSize: 28, fontWeight: '400', color: Colors.textPrimary },
  skipLink: { fontSize: 14, color: Colors.textSecondary },
});
