import * as SecureStore from 'expo-secure-store';

const KEY_PIN_ENABLED = 'dwella_biometric_enabled'; // key name kept for backwards compat
const KEY_PIN = 'dwella_pin';

// ── PIN enabled flag ──────────────────────────────────────────────────

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(KEY_PIN_ENABLED);
  return val === 'true';
}

export async function setPinEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(KEY_PIN_ENABLED, 'true');
  } else {
    await SecureStore.deleteItemAsync(KEY_PIN_ENABLED);
  }
}

// ── PIN hash ──────────────────────────────────────────────────────────

export async function savePin(pin: string): Promise<void> {
  const salt = Math.random().toString(36).slice(2, 10);
  const hash = btoa(salt + ':' + pin);
  await SecureStore.setItemAsync(KEY_PIN, hash);
  await SecureStore.setItemAsync(KEY_PIN_ENABLED, 'true');
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

export async function disablePin(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PIN);
  await SecureStore.deleteItemAsync(KEY_PIN_ENABLED);
}

// ── Legacy stubs (callers may still import these) ─────────────────────

/** @deprecated No longer stores a token — PIN is a local lock only. */
export async function savePinSession(_refreshToken?: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_PIN_ENABLED, 'true');
}

/** @deprecated Not used in the new architecture. */
export async function clearBiometricSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PIN_ENABLED);
}

/** @deprecated Use disablePin() instead. */
export const clearPin = disablePin;
