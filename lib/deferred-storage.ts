/**
 * Deferred AsyncStorage wrapper.
 *
 * On iOS the native AsyncStorage TurboModule can SIGABRT when multiple
 * callers (Zustand persist, Supabase session restore) hit it concurrently
 * before the React Native bridge is fully initialised.
 *
 * This wrapper queues all getItem / setItem / removeItem calls until
 * `enableStorage()` is called (once, from a useEffect in RootLayout).
 * After that, calls pass straight through to the real AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

let ready = false;
const pending: Array<() => void> = [];

/** Call once from a useEffect to flush queued storage operations. */
export function enableStorage() {
  ready = true;
  for (const fn of pending) fn();
  pending.length = 0;
}

export const DeferredStorage = {
  getItem: (key: string): Promise<string | null> => {
    if (ready) return AsyncStorage.getItem(key);
    return new Promise((resolve) => {
      pending.push(() => AsyncStorage.getItem(key).then(resolve));
    });
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (ready) return AsyncStorage.setItem(key, value);
    return new Promise((resolve) => {
      pending.push(() => AsyncStorage.setItem(key, value).then(resolve));
    });
  },
  removeItem: (key: string): Promise<void> => {
    if (ready) return AsyncStorage.removeItem(key);
    return new Promise((resolve) => {
      pending.push(() => AsyncStorage.removeItem(key).then(resolve));
    });
  },
};
