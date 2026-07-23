import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/shared/auth/store/auth.store';
import { ApiError } from '@/shared/http/http.client';

import { useAuth, useAuthBootstrap, useHomeGuard } from './useAuth';

const authServiceMock = vi.hoisted(() => ({
  logout: vi.fn(),
  me: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/shared/auth/api/auth.service', () => ({
  authService: authServiceMock,
}));

describe('auth hooks', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    authServiceMock.logout.mockReset();
    authServiceMock.me.mockReset();
    authServiceMock.refresh.mockReset();
  });

  it('bootstraps a refresh-based session', async () => {
    authServiceMock.refresh.mockResolvedValueOnce({
      accessToken: 'access-token',
      user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
    });

    renderHook(() => useAuthBootstrap());

    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
    expect(useAuthStore.getState().accessToken).toBe('access-token');
  });

  it('marks user unauthenticated when bootstrap fails', async () => {
    authServiceMock.refresh.mockRejectedValueOnce(new ApiError(101010, 'no cookie', 401));

    renderHook(() => useAuthBootstrap());

    await waitFor(() => expect(useAuthStore.getState().status).toBe('unauthenticated'));
  });

  it('preserves a retryable error state when bootstrap hits a server failure', async () => {
    authServiceMock.refresh.mockRejectedValueOnce(
      new ApiError(200002, 'database unavailable', 500),
    );

    renderHook(() => useAuthBootstrap());

    await waitFor(() => expect(useAuthStore.getState().status).toBe('error'));
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, user: null });
  });

  it('loads current user and clears state on logout', async () => {
    authServiceMock.me.mockResolvedValueOnce({
      id: 'user-id',
      username: 'zhangsan',
      email: 'user@example.com',
    });
    authServiceMock.logout.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth());
    await result.current.loadCurrentUser();
    expect(useAuthStore.getState().user?.email).toBe('user@example.com');

    await result.current.logout();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('reports whether home should redirect', () => {
    const { result, rerender } = renderHook(() => useHomeGuard());
    expect(result.current).toBe('show-home');

    useAuthStore.getState().setSession({
      accessToken: 'access-token',
      user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
    });
    rerender();

    expect(result.current).toBe('redirect-console');
  });
});
