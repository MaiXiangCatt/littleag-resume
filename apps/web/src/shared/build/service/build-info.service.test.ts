import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchDeployedBuildInfo } from './build-info.service';

describe('build info service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bypasses browser caching when loading the deployed manifest', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          environment: 'production',
          revision: 'b6fb3bacbfa1d1b209232626b88378b3e34a5537',
          version: '0.2.2',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchDeployedBuildInfo()).resolves.toMatchObject({
      revision: 'b6fb3bacbfa1d1b209232626b88378b3e34a5537',
    });
    expect(fetchMock).toHaveBeenCalledWith('/version.json', {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('rejects invalid manifests without affecting application requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ version: '0.2.2' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    );

    await expect(fetchDeployedBuildInfo()).rejects.toThrow(
      'The deployed build information is invalid',
    );
  });
});
