import { useEffect } from 'react';

import { authErrorMessage } from '@/models/auth';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';

export function useAuth() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const setFailed = useAuthStore((state) => state.setFailed);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);

  return {
    accessToken,
    isAuthenticated: status === 'authenticated',
    status,
    user,
    async loadCurrentUser() {
      setLoading();
      try {
        const currentUser = await authService.me();
        setUser(currentUser);
        return currentUser;
      } catch (error) {
        setFailed(authErrorMessage(error));
        throw error;
      }
    },
    async logout() {
      await authService.logout();
      clearSession();
    },
    setSession,
  };
}

export function useAuthBootstrap() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const setFailed = useAuthStore((state) => state.setFailed);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    if (accessToken) {
      return undefined;
    }

    let cancelled = false;
    setLoading();

    authService
      .refresh()
      .then((session) => {
        if (!cancelled) {
          setSession(session);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setFailed(authErrorMessage(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, setFailed, setLoading, setSession]);
}

export function useHomeGuard() {
  const status = useAuthStore((state) => state.status);
  return status === 'authenticated' ? 'redirect-console' : 'show-home';
}
