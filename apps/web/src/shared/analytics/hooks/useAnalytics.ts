import { useEffect } from 'react';

import type { AnalyticsEventName, AnalyticsMode } from '../model/analytics';
import { useAnalyticsStore } from '../store/analytics.store';

export function useAnalyticsWorkspace(mode: AnalyticsMode, active = true): void {
  const eligible = useAnalyticsStore(
    (state) =>
      state.isBootstrapped &&
      state.enabled &&
      state.choice === 'granted' &&
      Boolean(state.installationId) &&
      !state.pendingDeletionId,
  );
  const track = useAnalyticsStore((state) => state.track);
  useEffect(() => {
    if (active && eligible) track('workspace_activated', mode);
  }, [active, eligible, mode, track]);
}

export function useTrackAnalytics(): (eventName: AnalyticsEventName, mode: AnalyticsMode) => void {
  return useAnalyticsStore((state) => state.track);
}
