import {
  getCurrentAuthUser,
  loginAuthUser,
  logoutAuthUser,
  registerAuthUser,
} from '@/shared/api/generated/auth';
import type { AuthUser } from '@/shared/api/generated/model';

import type { AuthSession, LoginFormValues, RegisterFormValues } from '@/shared/auth/model/auth';
import { ApiError, httpRequest, refreshSession } from '@/shared/http/http.client';

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
    return refreshSession();
  },

  async logout() {
    unwrap(
      await logoutAuthUser({
        credentials: 'include',
      }),
    );
  },
};

export async function loadCurrentUser() {
  return httpRequest<AuthUser>('/api/auth/me');
}
