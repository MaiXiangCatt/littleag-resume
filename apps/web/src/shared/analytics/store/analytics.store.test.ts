import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ANALYTICS_INSTALLATION_KEY,
  ANALYTICS_PENDING_DELETION_KEY,
} from '../service/analytics.service';
import { useAnalyticsStore } from './analytics.store';

const apiMock = vi.hoisted(() => ({
  deleteAnalyticsInstallation: vi.fn(),
  getAnalyticsConfig: vi.fn(),
  postAnalyticsEvent: vi.fn(),
}));

vi.mock('@/shared/api/generated/auth', () => apiMock);

describe('analytics store deletion lifecycle', () => {
  const installationID = '58b30f6e-ab68-4cfc-b62e-3665729e4f52';

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(ANALYTICS_INSTALLATION_KEY, installationID);
    apiMock.deleteAnalyticsInstallation.mockReset();
    useAnalyticsStore.setState({
      choice: 'granted',
      consentVersion: '1',
      deletionError: false,
      dialogMode: 'settings',
      enabled: true,
      installationId: installationID,
      isBootstrapped: true,
      isSaving: false,
      pendingDeletionId: null,
      storageAvailable: true,
    });
  });

  it('stops tracking immediately, retains a pending ID on failure, and clears it after retry', async () => {
    apiMock.deleteAnalyticsInstallation.mockResolvedValueOnce({ status: 500 });
    await useAnalyticsStore.getState().withdraw();

    expect(useAnalyticsStore.getState()).toMatchObject({
      choice: 'denied',
      deletionError: true,
      installationId: null,
      pendingDeletionId: installationID,
    });
    expect(window.localStorage.getItem(ANALYTICS_PENDING_DELETION_KEY)).toBe(installationID);
    expect(window.localStorage.getItem(ANALYTICS_INSTALLATION_KEY)).toBe(installationID);

    apiMock.deleteAnalyticsInstallation.mockResolvedValueOnce({ status: 202 });
    await useAnalyticsStore.getState().retryDeletion();

    expect(useAnalyticsStore.getState()).toMatchObject({
      deletionError: false,
      pendingDeletionId: null,
    });
    expect(window.localStorage.getItem(ANALYTICS_PENDING_DELETION_KEY)).toBeNull();
    expect(window.localStorage.getItem(ANALYTICS_INSTALLATION_KEY)).toBeNull();
  });
});
