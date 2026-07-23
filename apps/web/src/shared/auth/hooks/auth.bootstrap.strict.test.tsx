import { StrictMode, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/shared/auth/store/auth.store';

import { useAuthBootstrap } from './useAuth';

function StrictModeWrapper({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}

describe('auth bootstrap in StrictMode', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    vi.restoreAllMocks();
  });

  it('shares one refresh request across concurrent bootstrap consumers', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            code: 0,
            message: '',
            data: {
              accessToken: 'access-token',
              user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useAuthBootstrap(), { wrapper: StrictModeWrapper });
    renderHook(() => useAuthBootstrap(), { wrapper: StrictModeWrapper });

    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/refresh',
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
  });
});
