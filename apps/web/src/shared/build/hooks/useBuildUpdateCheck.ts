import { useEffect } from 'react';

import { currentBuildInfo, isDeployedBuild } from '@/shared/build/model/build-info';
import { fetchDeployedBuildInfo } from '@/shared/build/service/build-info.service';
import { useBuildUpdateStore } from '@/shared/build/store/build-update.store';

const BUILD_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function useBuildUpdateCheck(): void {
  const reportDeployedBuild = useBuildUpdateStore((state) => state.reportDeployedBuild);

  useEffect(() => {
    if (!isDeployedBuild(currentBuildInfo)) {
      return;
    }

    let active = true;

    function checkForUpdate(): void {
      void fetchDeployedBuildInfo()
        .then((buildInfo) => {
          if (active) {
            reportDeployedBuild(buildInfo);
          }
        })
        .catch(() => {
          // Version checks must never interrupt the application.
        });
    }

    function checkWhenVisible(): void {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    }

    checkForUpdate();
    const intervalId = window.setInterval(checkForUpdate, BUILD_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', checkWhenVisible);
    window.addEventListener('focus', checkForUpdate);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', checkWhenVisible);
      window.removeEventListener('focus', checkForUpdate);
    };
  }, [reportDeployedBuild]);
}
