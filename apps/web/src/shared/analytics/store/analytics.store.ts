import { create } from 'zustand';

import type { AnalyticsConsentChoice, AnalyticsEventName, AnalyticsMode } from '../model/analytics';
import { analyticsService } from '../service/analytics.service';

type AnalyticsDialogMode = 'prompt' | 'settings' | null;

type AnalyticsState = {
  choice: AnalyticsConsentChoice | null;
  consentVersion: string | null;
  deletionError: boolean;
  dialogMode: AnalyticsDialogMode;
  enabled: boolean;
  installationId: string | null;
  isBootstrapped: boolean;
  isSaving: boolean;
  pendingDeletionId: string | null;
  storageAvailable: boolean;
  bootstrap: () => Promise<void>;
  choose: (choice: AnalyticsConsentChoice) => Promise<void>;
  closeSettings: () => void;
  openSettings: () => void;
  retryDeletion: () => Promise<boolean>;
  track: (eventName: AnalyticsEventName, mode: AnalyticsMode) => void;
  withdraw: () => Promise<void>;
};

let bootstrapPromise: Promise<void> | null = null;

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
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

  bootstrap: async () => {
    if (get().isBootstrapped) return;
    if (bootstrapPromise) return bootstrapPromise;
    bootstrapPromise = (async () => {
      const config = await analyticsService.config();
      if (!config?.enabled) {
        set({ enabled: false, isBootstrapped: true });
        return;
      }
      let stored = analyticsService.readStorage(config.consentVersion);
      if (!stored.available) {
        set({
          consentVersion: config.consentVersion,
          enabled: true,
          isBootstrapped: true,
          storageAvailable: false,
        });
        return;
      }
      if (stored.pendingDeletionId) {
        const deleted = await analyticsService.deleteInstallation(stored.pendingDeletionId);
        if (deleted) {
          analyticsService.completeDeletion();
          stored = analyticsService.readStorage(config.consentVersion);
        }
      }
      const consent =
        stored.consent?.choice === 'granted' && !stored.installationId ? null : stored.consent;
      set({
        choice: consent?.choice ?? null,
        consentVersion: config.consentVersion,
        deletionError: Boolean(stored.pendingDeletionId),
        dialogMode: stored.pendingDeletionId ? 'settings' : consent ? null : 'prompt',
        enabled: true,
        installationId: consent?.choice === 'granted' ? stored.installationId : null,
        isBootstrapped: true,
        pendingDeletionId: stored.pendingDeletionId,
        storageAvailable: true,
      });
    })().finally(() => {
      bootstrapPromise = null;
    });
    return bootstrapPromise;
  },

  choose: async (choice) => {
    const { consentVersion, pendingDeletionId } = get();
    if (!consentVersion || get().isSaving) return;
    set({ isSaving: true });
    try {
      if (choice === 'granted' && pendingDeletionId) {
        const deleted = await get().retryDeletion();
        if (!deleted) return;
      }
      const stored = analyticsService.saveChoice(choice, consentVersion);
      set({
        choice,
        deletionError: false,
        dialogMode: null,
        installationId: choice === 'granted' ? stored.installationId : null,
      });
    } catch {
      set({ storageAvailable: false });
    } finally {
      set({ isSaving: false });
    }
  },

  closeSettings: () => {
    if (get().dialogMode === 'settings' && !get().isSaving) {
      set({ dialogMode: null });
    }
  },

  openSettings: () => {
    if (get().enabled && get().storageAvailable) {
      set({ dialogMode: 'settings' });
    }
  },

  retryDeletion: async () => {
    const pendingDeletionId = get().pendingDeletionId;
    if (!pendingDeletionId) return true;
    const deleted = await analyticsService.deleteInstallation(pendingDeletionId);
    if (!deleted) {
      set({ deletionError: true });
      return false;
    }
    try {
      analyticsService.completeDeletion();
      set({
        deletionError: false,
        installationId: null,
        pendingDeletionId: null,
      });
      return true;
    } catch {
      set({ deletionError: true, storageAvailable: false });
      return false;
    }
  },

  track: (eventName, mode) => {
    const state = get();
    if (
      !state.enabled ||
      state.choice !== 'granted' ||
      !state.installationId ||
      !state.consentVersion ||
      state.pendingDeletionId
    ) {
      return;
    }
    void analyticsService.track(state.installationId, state.consentVersion, eventName, mode);
  },

  withdraw: async () => {
    const { consentVersion, installationId } = get();
    if (!consentVersion || get().isSaving) return;
    set({ isSaving: true });
    try {
      analyticsService.saveChoice('denied', consentVersion);
      set({ choice: 'denied', installationId: null });
      if (!installationId) return;
      analyticsService.markPendingDeletion(installationId);
      set({ pendingDeletionId: installationId });
      await get().retryDeletion();
    } catch {
      set({ deletionError: true, storageAvailable: false });
    } finally {
      set({ isSaving: false });
    }
  },
}));
