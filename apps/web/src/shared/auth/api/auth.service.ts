import {
  confirmAuthEmailVerification,
  getCurrentAuthUser,
  loginAuthUser,
  logoutAuthUser,
  registerAuthUser,
  resendAuthEmailVerification,
  sendAuthRegistrationEmailVerification,
} from '@/shared/api/generated/auth';
import type { AuthUser } from '@/shared/api/generated/model';

import type {
  AuthSession,
  EmailVerification,
  EmailVerificationFormValues,
  LoginFormValues,
  RegisterFormValues,
} from '@/shared/auth/model/auth';
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

  async sendRegistrationEmailVerification(email: string) {
    return unwrap(
      await sendAuthRegistrationEmailVerification(
        { email },
        {
          credentials: 'include',
        },
      ),
    ) as EmailVerification;
  },

  async confirmEmailVerification(email: string, values: EmailVerificationFormValues) {
    return unwrap(
      await confirmAuthEmailVerification(
        { email, code: values.code },
        {
          credentials: 'include',
        },
      ),
    ) as AuthSession;
  },

  async resendEmailVerification(email: string, password: string) {
    return unwrap(
      await resendAuthEmailVerification(
        { email, password },
        {
          credentials: 'include',
        },
      ),
    ) as EmailVerification;
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
