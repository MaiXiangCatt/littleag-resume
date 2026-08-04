import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBuildUpdateStore } from '@/shared/build/store/build-update.store';

import { BuildUpdateNotifier } from './BuildUpdateNotifier';

const toastMock = vi.hoisted(() => ({
  info: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: toastMock,
}));

describe('BuildUpdateNotifier', () => {
  beforeEach(() => {
    toastMock.info.mockReset();
    useBuildUpdateStore.getState().clearUpdate();
  });

  it('asks users to refresh without exposing the deployed version', async () => {
    render(<BuildUpdateNotifier />);

    act(() => {
      useBuildUpdateStore.getState().markStaleAssets();
    });

    await waitFor(() => expect(toastMock.info).toHaveBeenCalledTimes(1));
    const [title, options] = toastMock.info.mock.calls[0];
    expect(title).toBe('新版本已经发布');
    expect(options.description).toBe('页面资源已经更新，刷新后即可继续使用。');
    expect(options.description).not.toMatch(/\d+\.\d+\.\d+/);
    expect(options.action.label).toBe('立即刷新');
  });
});
