import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter, useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { savePin } from '@/lib/biometric-auth';
import { useTheme } from '@/lib/theme-context';

type Step = 'enter' | 'confirm';

export default function PinSetupScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
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
          <View key={i} style={[styles.dot, { borderColor: colors.primary }, pin.length > i && { backgroundColor: colors.primary }]} />
        ))}
      </View>

      {!!error && <Text style={[styles.error, { color: colors.statusOverdue }]}>{error}</Text>}

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

      <TouchableOpacity onPress={handleSkip}>
        <Text style={[styles.skipLink, { color: colors.textSecondary }]}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  header: { alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  dotsRow: { flexDirection: 'row', gap: 16 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, backgroundColor: 'transparent',
  },
  error: { fontSize: 13, textAlign: 'center' },
  numpad: { width: '100%', gap: 8 },
  numpadRow: { flexDirection: 'row', justifyContent: 'space-around' },
  numpadKey: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  numpadDigit: { fontSize: 28, fontWeight: '400' },
  skipLink: { fontSize: 14 },
});
