import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

function pinEnabledKey(userId: string) {
  return `dwella_biometric_enabled_${userId}`;
}

function pinKey(userId: string) {
  return `dwella_pin_${userId}`;
}

// ── PIN enabled flag ──────────────────────────────────────────────────

export async function isBiometricEnabled(userId: string): Promise<boolean> {
  if (Platform.OS === 'web' || !userId) return false;
  const val = await SecureStore.getItemAsync(pinEnabledKey(userId));
  return val === 'true';
}

export async function setPinEnabled(userId: string, enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(pinEnabledKey(userId), 'true');
  } else {
    await SecureStore.deleteItemAsync(pinEnabledKey(userId));
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

export async function savePin(userId: string, pin: string): Promise<void> {
  const salt = Crypto.randomUUID().replace(/-/g, '');
  const stored = await hashPin(pin, salt);
  await SecureStore.setItemAsync(pinKey(userId), stored);
  await SecureStore.setItemAsync(pinEnabledKey(userId), 'true');
}

export async function verifyPin(userId: string, pin: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(pinKey(userId));
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
    await savePin(userId, pin);
    return true;
  } catch {
    return false;
  }
}

export async function isPinSet(userId: string): Promise<boolean> {
  if (!userId) return false;
  const val = await SecureStore.getItemAsync(pinKey(userId));
  return !!val;
}

export async function disablePin(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(pinKey(userId));
  await SecureStore.deleteItemAsync(pinEnabledKey(userId));
}

// ── Legacy stubs (callers may still import these) ─────────────────────

/** @deprecated No longer stores a token — PIN is a local lock only. */
export async function savePinSession(userId: string, _refreshToken?: string): Promise<void> {
  await SecureStore.setItemAsync(pinEnabledKey(userId), 'true');
}

/** @deprecated Not used in the new architecture. */
export async function clearBiometricSession(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(pinEnabledKey(userId));
}

/** @deprecated Use disablePin() instead. */
export const clearPin = disablePin;
