/**
 * SecureStore-backed storage adapter.
 *
 * Replaces AsyncStorage to avoid a crash-on-launch caused by the native
 * AsyncStorage TurboModule (`RCT_EXPORT_METHOD` with void+callback).
 * The void method invocation path in React Native's ObjCTurboModule throws
 * an NSException during startup, and the error handler then crashes Hermes
 * by accessing the JS runtime from a background dispatch thread (SIGSEGV).
 *
 * expo-secure-store uses the Expo Modules bridge (EXNativeModulesProxy)
 * which dispatches via Promise-based invocation — a completely different
 * native path that doesn't have this bug.
 */
import * as SecureStore from 'expo-secure-store';

const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const DeferredStorage = {
  getItem: (key: string): Promise<string | null> =>
    SecureStore.getItemAsync(key, OPTS),

  setItem: (key: string, value: string): Promise<void> =>
    SecureStore.setItemAsync(key, value, OPTS),

  removeItem: (key: string): Promise<void> =>
    SecureStore.deleteItemAsync(key, OPTS),
};

/**
 * No-op kept for backwards compatibility — RootLayout still calls this.
 * With SecureStore there's no deferral needed.
 */
export function enableStorage() {}
