import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from './auth.store';

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
  });

  it('stores access token, current user, and auth status in memory', () => {
    useAuthStore.getState().setLoading();
    expect(useAuthStore.getState().status).toBe('loading');

    useAuthStore.getState().setSession({
      accessToken: 'access-token',
      user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com', emailVerified: true },
    });

    expect(useAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      accessToken: 'access-token',
      user: { email: 'user@example.com' },
      error: null,
    });

    useAuthStore.getState().clearSession();
    expect(useAuthStore.getState()).toMatchObject({
      status: 'unauthenticated',
      accessToken: null,
      user: null,
    });
  });

  it('captures auth failures without persisting stale tokens', () => {
    useAuthStore.getState().setSession({
      accessToken: 'access-token',
      user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com', emailVerified: true },
    });

    useAuthStore.getState().setFailed('Session expired');

    expect(useAuthStore.getState()).toMatchObject({
      status: 'unauthenticated',
      accessToken: null,
      user: null,
      error: 'Session expired',
    });
  });
});
