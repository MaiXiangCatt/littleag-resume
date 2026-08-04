import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANALYTICS_INSTALLATION_KEY } from '../service/analytics.service';
import { useAnalyticsStore } from '../store/analytics.store';
import { AnalyticsConsentController } from './AnalyticsConsentDialog';

const apiMock = vi.hoisted(() => ({
  deleteAnalyticsInstallation: vi.fn(),
  getAnalyticsConfig: vi.fn(),
  postAnalyticsEvent: vi.fn(),
}));

vi.mock('@/shared/api/generated/auth', () => apiMock);

describe('AnalyticsConsentController', () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiMock.deleteAnalyticsInstallation.mockReset();
    apiMock.getAnalyticsConfig.mockReset();
    apiMock.postAnalyticsEvent.mockReset();
    apiMock.getAnalyticsConfig.mockResolvedValue({
      data: { consentVersion: '1', enabled: true },
      status: 200,
    });
    apiMock.deleteAnalyticsInstallation.mockResolvedValue({ status: 202 });
    useAnalyticsStore.setState({
      choice: null,
      consentVersion: null,
      deletionError: false,
      dialogMode: null,
      enabled: false,
      installationId: null,
      isBootstrapped: false,
      isSaving: false,
      pendingDeletionId: null,
      storageAvailable: true,
    });
  });

  it('blocks an interactive route until the user explicitly declines', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/local']}>
        <AnalyticsConsentController />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '关闭' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '暂不参与' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(ANALYTICS_INSTALLATION_KEY)).toBeNull();
    expect(apiMock.postAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('does not initialize analytics on legal routes', () => {
    render(
      <MemoryRouter initialEntries={['/legal/privacy']}>
        <AnalyticsConsentController />
      </MemoryRouter>,
    );

    expect(apiMock.getAnalyticsConfig).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
