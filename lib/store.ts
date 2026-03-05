import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { User } from './types';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  propertyRefreshAt: number;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
  bumpPropertyRefresh: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  propertyRefreshAt: 0,
  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ session: null, user: null, isLoading: false }),
  bumpPropertyRefresh: () => set((s) => ({ propertyRefreshAt: s.propertyRefreshAt + 1 })),
}));
