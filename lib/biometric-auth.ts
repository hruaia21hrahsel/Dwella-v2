import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const KEY_PIN_ENABLED = 'dwella_biometric_enabled'; // key name kept for backwards compat
const KEY_PIN = 'dwella_pin';

// ── PIN enabled flag ──────────────────────────────────────────────────

export async function isBiometricEnabled(): Promise<boolean> {
  // expo-secure-store ships an empty stub on web — all methods are undefined.
  if (Platform.OS === 'web') return false;
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
//
// Storage format (new): "sha256:{salt}:{hex-digest}"
//   salt    = 32 hex chars (UUID without dashes)
//   digest  = SHA-256(salt + ":" + pin), hex-encoded
//
// Legacy format (old):  btoa(salt + ":" + pin)
//   Verified and silently upgraded to the new format on next correct entry.

async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + ':' + pin,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  return `sha256:${salt}:${digest}`;
}

export async function savePin(pin: string): Promise<void> {
  const salt = Crypto.randomUUID().replace(/-/g, '');
  const stored = await hashPin(pin, salt);
  await SecureStore.setItemAsync(KEY_PIN, stored);
  await SecureStore.setItemAsync(KEY_PIN_ENABLED, 'true');
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(KEY_PIN);
  if (!stored) return false;

  // New format: sha256:{salt}:{digest}
  if (stored.startsWith('sha256:')) {
    const parts = stored.split(':');
    if (parts.length !== 3) return false;
    const [, salt, storedDigest] = parts;
    const candidate = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      salt + ':' + pin,
      { encoding: Crypto.CryptoEncoding.HEX },
    );
    return candidate === storedDigest;
  }

  // Legacy format: btoa(salt:pin) — verify then silently upgrade to new format
  try {
    const decoded = atob(stored);
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) return false;
    const storedPin = decoded.slice(colonIdx + 1);
    if (storedPin !== pin) return false;
    // Correct — upgrade storage to proper hash
    await savePin(pin);
    return true;
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
