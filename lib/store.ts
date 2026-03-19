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
  /** Keyed by user ID so onboarding state is per-account, not per-device. */
  onboardingCompletedByUser: Record<string, boolean>;
  themeMode: ThemeMode;
  aiDisclosureAccepted: boolean;
  setAiDisclosureAccepted: (accepted: boolean) => void;
  /**
   * Whether the app UI is locally locked. Starts true on every cold launch.
   * Set to false when the user enters a correct PIN or logs in with email/password.
   * Has nothing to do with the Supabase session — the session can be valid while
   * the app is locked, and this flag never touches the backend.
   */
  isLocked: boolean;
  /** In-memory only (not persisted). Index into TOUR_STEPS, or null when tour is inactive. */
  tourStep: number | null;
  /** In-memory only. Route AuthGuard should navigate to instead of the default post-auth destination. */
  pendingRoute: string | null;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
  bumpPropertyRefresh: () => void;
  setOnboardingCompleted: () => void;
  resetOnboarding: () => void;
  /** Derived helper — true when the current user has completed onboarding. */
  isOnboardingCompleted: () => boolean;
  setLocked: (locked: boolean) => void;
  setTourStep: (step: number | null) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setPendingRoute: (route: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      user: null,
      isLoading: true,
      propertyRefreshAt: 0,
      onboardingCompletedByUser: {},
      themeMode: 'dark' as ThemeMode,
      aiDisclosureAccepted: false,
      setAiDisclosureAccepted: (aiDisclosureAccepted) => set({ aiDisclosureAccepted }),
      isLocked: true,
      tourStep: null,
      pendingRoute: null,
      setSession: (session) => set({ session }),
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      clearAuth: () => set({ session: null, user: null, isLoading: false }),
      bumpPropertyRefresh: () => set((s) => ({ propertyRefreshAt: s.propertyRefreshAt + 1 })),
      setOnboardingCompleted: () => set((s) => ({
        onboardingCompletedByUser: {
          ...s.onboardingCompletedByUser,
          [s.user?.id ?? '_anon']: true,
        },
      })),
      resetOnboarding: () => set((s) => {
        const { [s.user?.id ?? '_anon']: _, ...rest } = s.onboardingCompletedByUser;
        return { onboardingCompletedByUser: rest };
      }),
      isOnboardingCompleted: (): boolean => {
        const s = get();
        return s.onboardingCompletedByUser[s.user?.id ?? '_anon'] ?? false;
      },
      setLocked: (isLocked) => set({ isLocked }),
      setTourStep: (tourStep) => set({ tourStep }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setPendingRoute: (pendingRoute) => set({ pendingRoute }),
    }),
    {
      name: 'dwella-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist onboardingCompletedByUser and themeMode. isLocked must reset
      // to true on every cold launch so the PIN screen is always shown.
      partialize: (state) => ({
        onboardingCompletedByUser: state.onboardingCompletedByUser,
        themeMode: state.themeMode,
        aiDisclosureAccepted: state.aiDisclosureAccepted,
      }),
    }
  )
);
