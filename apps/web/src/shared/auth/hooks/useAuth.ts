import { useEffect } from 'react';

import { authErrorMessage } from '@/shared/auth/model/auth';
import { authService } from '@/shared/auth/api/auth.service';
import { useAuthStore } from '@/shared/auth/store/auth.store';
import { isSessionInvalidError } from '@/shared/http/http.client';

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
  const setTransientFailure = useAuthStore((state) => state.setTransientFailure);

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
          const message = authErrorMessage(error);
          if (isSessionInvalidError(error)) {
            setFailed(message);
          } else {
            setTransientFailure(message);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, setFailed, setLoading, setSession, setTransientFailure]);
}

export function useHomeGuard() {
  const status = useAuthStore((state) => state.status);
  return status === 'authenticated' ? 'redirect-console' : 'show-home';
}
