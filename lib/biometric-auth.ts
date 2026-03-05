import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const KEY_BIOMETRIC_ENABLED = 'dwella_biometric_enabled';
const KEY_REFRESH_TOKEN = 'dwella_refresh_token';
const KEY_PIN = 'dwella_pin';

// ── Storage ──────────────────────────────────────────────────────────

export async function saveBiometricSession(refreshToken: string) {
  await SecureStore.setItemAsync(KEY_REFRESH_TOKEN, refreshToken);
  await SecureStore.setItemAsync(KEY_BIOMETRIC_ENABLED, 'true');
}

export async function getBiometricRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_REFRESH_TOKEN);
}

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(KEY_BIOMETRIC_ENABLED);
  return val === 'true';
}

export async function clearBiometricSession() {
  await SecureStore.deleteItemAsync(KEY_BIOMETRIC_ENABLED);
  await SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN);
}

// ── PIN ──────────────────────────────────────────────────────────────

export async function savePin(pin: string) {
  // Simple hash: pin + salt stored together
  const salt = Math.random().toString(36).slice(2, 10);
  const hash = btoa(salt + ':' + pin); // basic obfuscation; SecureStore is OS-encrypted
  await SecureStore.setItemAsync(KEY_PIN, hash);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(KEY_PIN);
  if (!stored) return false;
  try {
    const decoded = atob(stored);
    const [, storedPin] = decoded.split(':');
    return storedPin === pin;
  } catch {
    return false;
  }
}

export async function isPinSet(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(KEY_PIN);
  return !!val;
}

export async function clearPin() {
  await SecureStore.deleteItemAsync(KEY_PIN);
}

// ── Biometric hardware ────────────────────────────────────────────────

export async function getBiometricType(): Promise<'face' | 'fingerprint' | 'none'> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return 'none';
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return 'none';
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
  return 'none';
}

export async function promptBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Sign in to Dwella',
    fallbackLabel: 'Use PIN',
    cancelLabel: 'Cancel',
    disableDeviceFallback: true, // we handle fallback ourselves
  });
  return result.success;
}
