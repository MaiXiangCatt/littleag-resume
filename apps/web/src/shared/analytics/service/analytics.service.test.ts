import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ANALYTICS_CONSENT_KEY,
  ANALYTICS_INSTALLATION_KEY,
  analyticsService,
} from './analytics.service';

const apiMock = vi.hoisted(() => ({
  deleteAnalyticsInstallation: vi.fn(),
  getAnalyticsConfig: vi.fn(),
  postAnalyticsEvent: vi.fn(),
}));

vi.mock('@/shared/api/generated/auth', () => apiMock);

describe('analytics service', () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiMock.deleteAnalyticsInstallation.mockReset();
    apiMock.getAnalyticsConfig.mockReset();
    apiMock.postAnalyticsEvent.mockReset();
  });

  it('creates an installation ID only after consent is granted', () => {
    const installationID = '58b30f6e-ab68-4cfc-b62e-3665729e4f52';
    vi.spyOn(window.crypto, 'randomUUID').mockReturnValue(installationID);

    analyticsService.saveChoice('denied', '1');
    expect(window.localStorage.getItem(ANALYTICS_INSTALLATION_KEY)).toBeNull();

    const stored = analyticsService.saveChoice('granted', '1');
    expect(stored.installationId).toBe(installationID);
    expect(JSON.parse(window.localStorage.getItem(ANALYTICS_CONSENT_KEY) ?? '{}')).toMatchObject({
      choice: 'granted',
      version: '1',
    });
    vi.restoreAllMocks();
  });

  it('retries a network failure once with the same event ID and no credentials', async () => {
    const eventID = '7d569f9c-d05b-4c79-8614-1ae01347d54a';
    vi.spyOn(window.crypto, 'randomUUID').mockReturnValue(eventID);
    apiMock.postAnalyticsEvent
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce({ status: 202 });

    await analyticsService.track(
      '58b30f6e-ab68-4cfc-b62e-3665729e4f52',
      '1',
      'resume_exported_pdf',
      'local',
    );

    expect(apiMock.postAnalyticsEvent).toHaveBeenCalledTimes(2);
    expect(apiMock.postAnalyticsEvent.mock.calls[0]?.[0]).toEqual(
      apiMock.postAnalyticsEvent.mock.calls[1]?.[0],
    );
    expect(apiMock.postAnalyticsEvent.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'omit',
      keepalive: true,
    });
    vi.restoreAllMocks();
  });
});
