import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/shared/auth/store/auth.store';

import { ApiError, httpRequest } from './http.client';

describe('http client', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    vi.restoreAllMocks();
  });

  it('unwraps unified BaseResponse data and injects Authorization header', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'access-token',
      user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 0, message: '', data: { ok: true } }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(httpRequest<{ ok: boolean }>('/api/private')).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/private',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    );
  });

  it('throws ApiError for non-zero envelopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 101002, message: 'Invalid', data: null }), {
          status: 401,
        }),
      ),
    );

    await expect(httpRequest('/api/private')).rejects.toMatchObject({
      code: 101002,
      message: 'Invalid',
      status: 401,
    } satisfies Partial<ApiError>);
  });

  it('performs one credentialed refresh retry for expired access tokens', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'old-token',
      user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 101003, message: 'Expired', data: null }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            message: '',
            data: {
              accessToken: 'new-token',
              user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, message: '', data: { ok: true } }), {
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(httpRequest('/api/private')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/auth/refresh',
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/private',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer new-token' }),
      }),
    );
  });

  it('shares one refresh across concurrent expired requests', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'old-token',
      user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
    });

    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === '/api/auth/refresh') {
        return new Response(
          JSON.stringify({
            code: 0,
            message: '',
            data: {
              accessToken: 'new-token',
              user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
            },
          }),
          { status: 200 },
        );
      }

      const headers = init?.headers as Record<string, string> | undefined;
      if (headers?.Authorization === 'Bearer old-token') {
        return new Response(
          JSON.stringify({ code: 101003, message: 'Expired', data: null }),
          { status: 401 },
        );
      }

      return new Response(JSON.stringify({ code: 0, message: '', data: { ok: true } }), {
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      Promise.all([httpRequest('/api/private/one'), httpRequest('/api/private/two')]),
    ).resolves.toEqual([{ ok: true }, { ok: true }]);

    expect(fetchMock.mock.calls.filter(([input]) => input === '/api/auth/refresh')).toHaveLength(1);
  });
});
