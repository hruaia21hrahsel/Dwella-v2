import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { User } from './types';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  propertyRefreshAt: number;
  onboardingCompleted: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
  bumpPropertyRefresh: () => void;
  setOnboardingCompleted: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      isLoading: true,
      propertyRefreshAt: 0,
      onboardingCompleted: false,
      setSession: (session) => set({ session }),
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      clearAuth: () => set({ session: null, user: null, isLoading: false }),
      bumpPropertyRefresh: () => set((s) => ({ propertyRefreshAt: s.propertyRefreshAt + 1 })),
      setOnboardingCompleted: () => set({ onboardingCompleted: true }),
    }),
    {
      name: 'dwella-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ onboardingCompleted: state.onboardingCompleted }),
    }
  )
);
