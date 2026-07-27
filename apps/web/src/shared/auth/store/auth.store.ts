import { create } from 'zustand';

import type { AuthSession, AuthUser } from '@/shared/auth/model/auth';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';

type AuthState = {
  accessToken: string | null;
  error: string | null;
  status: AuthStatus;
  user: AuthUser | null;
  clearSession: () => void;
  reset: () => void;
  setFailed: (message: string) => void;
  setLoading: () => void;
  setSession: (session: AuthSession) => void;
  setTransientFailure: (message: string) => void;
  setUser: (user: AuthUser) => void;
};

const initialState = {
  accessToken: null,
  error: null,
  status: 'idle' as AuthStatus,
  user: null,
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  ...initialState,
  clearSession: () =>
    set({ accessToken: null, error: null, status: 'unauthenticated', user: null }),
  reset: () => set(initialState),
  setFailed: (message) =>
    set({ accessToken: null, error: message, status: 'unauthenticated', user: null }),
  setLoading: () => set({ error: null, status: 'loading' }),
  setSession: (session) =>
    set({
      accessToken: session.accessToken,
      error: null,
      status: 'authenticated',
      user: session.user,
    }),
  setTransientFailure: (message) => set({ error: message, status: 'error' }),
  setUser: (user) =>
    set({
      error: null,
      status: get().accessToken ? 'authenticated' : get().status,
      user,
    }),
}));
