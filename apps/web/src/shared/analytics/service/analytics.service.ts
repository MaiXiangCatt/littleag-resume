import {
  deleteAnalyticsInstallation,
  getAnalyticsConfig,
  postAnalyticsEvent,
} from '@/shared/api/generated/auth';
import type { AnalyticsEventRequest } from '@/shared/api/generated/model/analyticsEventRequest';

import type {
  AnalyticsConsentChoice,
  AnalyticsConsentRecord,
  AnalyticsEventName,
  AnalyticsMode,
} from '../model/analytics';
import { parseConsentRecord } from '../model/analytics';

export const ANALYTICS_CONSENT_KEY = 'littleag.analytics.consent';
export const ANALYTICS_INSTALLATION_KEY = 'littleag.analytics.installation-id';
export const ANALYTICS_PENDING_DELETION_KEY = 'littleag.analytics.pending-deletion-id';

export type AnalyticsStoredState = {
  available: boolean;
  consent: AnalyticsConsentRecord | null;
  installationId: string | null;
  pendingDeletionId: string | null;
};

function readAnalyticsStorage(consentVersion: string): AnalyticsStoredState {
  try {
    return {
      available: true,
      consent: parseConsentRecord(
        window.localStorage.getItem(ANALYTICS_CONSENT_KEY),
        consentVersion,
      ),
      installationId: validUUID(window.localStorage.getItem(ANALYTICS_INSTALLATION_KEY)),
      pendingDeletionId: validUUID(window.localStorage.getItem(ANALYTICS_PENDING_DELETION_KEY)),
    };
  } catch {
    return {
      available: false,
      consent: null,
      installationId: null,
      pendingDeletionId: null,
    };
  }
}

export const analyticsService = {
  async config(): Promise<{ consentVersion: string; enabled: boolean } | null> {
    try {
      const response = await getAnalyticsConfig({ credentials: 'omit' });
      return response.status === 200 ? response.data : null;
    } catch {
      return null;
    }
  },

  readStorage: readAnalyticsStorage,

  saveChoice(choice: AnalyticsConsentChoice, consentVersion: string): AnalyticsStoredState {
    const record: AnalyticsConsentRecord = {
      choice,
      updatedAt: new Date().toISOString(),
      version: consentVersion,
    };
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify(record));
    let installationId = validUUID(window.localStorage.getItem(ANALYTICS_INSTALLATION_KEY));
    if (choice === 'granted' && !installationId) {
      installationId = window.crypto.randomUUID();
      window.localStorage.setItem(ANALYTICS_INSTALLATION_KEY, installationId);
    }
    return readAnalyticsStorage(consentVersion);
  },

  markPendingDeletion(installationId: string): void {
    window.localStorage.setItem(ANALYTICS_PENDING_DELETION_KEY, installationId);
  },

  completeDeletion(): void {
    window.localStorage.removeItem(ANALYTICS_PENDING_DELETION_KEY);
    window.localStorage.removeItem(ANALYTICS_INSTALLATION_KEY);
  },

  async deleteInstallation(installationId: string): Promise<boolean> {
    try {
      const response = await deleteAnalyticsInstallation(
        { installationId },
        {
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        },
      );
      return response.status === 202;
    } catch {
      return false;
    }
  },

  async track(
    installationId: string,
    consentVersion: string,
    eventName: AnalyticsEventName,
    mode: AnalyticsMode,
  ): Promise<void> {
    const input: AnalyticsEventRequest = {
      consentVersion: consentVersion as AnalyticsEventRequest['consentVersion'],
      eventId: window.crypto.randomUUID(),
      eventName: eventName as AnalyticsEventRequest['eventName'],
      installationId,
      mode: mode as AnalyticsEventRequest['mode'],
    };
    const options: RequestInit = {
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await postAnalyticsEvent(input, options);
        if (response.status < 500) return;
      } catch {
        // Retry once with the same event ID.
      }
    }
  },
};

function validUUID(value: string | null): string | null {
  if (
    !value ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    return null;
  }
  return value;
}
