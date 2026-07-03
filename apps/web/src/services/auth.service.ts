import {
  getCurrentAuthUser,
  loginAuthUser,
  logoutAuthUser,
  refreshAuthSession,
  registerAuthUser,
} from './generated/auth';
import type { AuthUser } from './generated/model';

import type { AuthSession, LoginFormValues, RegisterFormValues } from '@/models/auth';
import { ApiError, httpRequest } from '@/services/http.client';
import { useAuthStore } from '@/store/auth.store';

type GeneratedResponse<T> = {
  data: {
    code: number;
    data: T;
    message: string;
  };
  status: number;
};

function unwrap<T>(response: GeneratedResponse<T>) {
  if (response.status < 200 || response.status >= 300 || response.data.code !== 0) {
    throw new ApiError(response.data.code, response.data.message, response.status);
  }
  return response.data.data;
}

export const authService = {
  async register(values: RegisterFormValues) {
    return unwrap(
      await registerAuthUser(values, {
        credentials: 'include',
      }),
    ) as AuthSession;
  },

  async login(values: LoginFormValues) {
    return unwrap(
      await loginAuthUser(values, {
        credentials: 'include',
      }),
    ) as AuthSession;
  },

  async me() {
    return unwrap(await getCurrentAuthUser()) as AuthUser;
  },

  async refresh() {
    return unwrap(
      await refreshAuthSession({
        credentials: 'include',
      }),
    ) as AuthSession;
  },

  async logout() {
    await logoutAuthUser({
      credentials: 'include',
    });
    useAuthStore.getState().clearSession();
  },
};

export async function loadCurrentUser() {
  return httpRequest<AuthUser>('/api/auth/me');
}
