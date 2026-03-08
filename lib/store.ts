import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { User } from './types';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  propertyRefreshAt: number;
  onboardingCompleted: boolean;
  themeMode: ThemeMode;
  /**
   * Whether the app UI is locally locked. Starts true on every cold launch.
   * Set to false when the user enters a correct PIN or logs in with email/password.
   * Has nothing to do with the Supabase session — the session can be valid while
   * the app is locked, and this flag never touches the backend.
   */
  isLocked: boolean;
  /** In-memory only (not persisted). Index into TOUR_STEPS, or null when tour is inactive. */
  tourStep: number | null;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
  bumpPropertyRefresh: () => void;
  setOnboardingCompleted: () => void;
  resetOnboarding: () => void;
  setLocked: (locked: boolean) => void;
  setTourStep: (step: number | null) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      isLoading: true,
      propertyRefreshAt: 0,
      onboardingCompleted: false,
      themeMode: 'light' as ThemeMode,
      isLocked: true,
      tourStep: null,
      setSession: (session) => set({ session }),
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      clearAuth: () => set({ session: null, user: null, isLoading: false }),
      bumpPropertyRefresh: () => set((s) => ({ propertyRefreshAt: s.propertyRefreshAt + 1 })),
      setOnboardingCompleted: () => set({ onboardingCompleted: true }),
      resetOnboarding: () => set({ onboardingCompleted: false }),
      setLocked: (isLocked) => set({ isLocked }),
      setTourStep: (tourStep) => set({ tourStep }),
      setThemeMode: (themeMode) => set({ themeMode }),
    }),
    {
      name: 'dwella-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist onboardingCompleted. isLocked must reset to true on every
      // cold launch so the PIN screen is always shown when the app restarts.
      partialize: (state) => ({ onboardingCompleted: state.onboardingCompleted, themeMode: state.themeMode }),
    }
  )
);
