import * as SecureStore from 'expo-secure-store';

const KEY_PIN_ENABLED = 'dwella_biometric_enabled'; // key name kept for backwards compat
const KEY_REFRESH_TOKEN = 'dwella_refresh_token';
const KEY_PIN = 'dwella_pin';

// ── Session storage ───────────────────────────────────────────────────

export async function savePinSession(refreshToken: string) {
  await SecureStore.setItemAsync(KEY_REFRESH_TOKEN, refreshToken);
  await SecureStore.setItemAsync(KEY_PIN_ENABLED, 'true');
}

export async function getBiometricRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_REFRESH_TOKEN);
}

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(KEY_PIN_ENABLED);
  return val === 'true';
}

export async function clearBiometricSession() {
  await SecureStore.deleteItemAsync(KEY_PIN_ENABLED);
  await SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN);
}

// ── PIN ──────────────────────────────────────────────────────────────

export async function savePin(pin: string) {
  const salt = Math.random().toString(36).slice(2, 10);
  const hash = btoa(salt + ':' + pin);
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
