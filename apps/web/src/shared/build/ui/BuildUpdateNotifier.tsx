import { useEffect } from 'react';
import { toast } from 'sonner';

import { useBuildUpdateCheck } from '@/shared/build/hooks/useBuildUpdateCheck';
import { useBuildUpdateStore } from '@/shared/build/store/build-update.store';

const BUILD_UPDATE_TOAST_ID = 'build-update';

export function BuildUpdateNotifier() {
  useBuildUpdateCheck();
  const clearUpdate = useBuildUpdateStore((state) => state.clearUpdate);
  const reason = useBuildUpdateStore((state) => state.reason);

  useEffect(() => {
    if (!reason) {
      return;
    }

    const description =
      reason === 'stale-assets'
        ? '页面资源已经更新，刷新后即可继续使用。'
        : '刷新页面即可使用最新功能。';

    toast.info('新版本已经发布', {
      action: {
        label: '立即刷新',
        onClick: () => window.location.reload(),
      },
      description,
      duration: Infinity,
      id: BUILD_UPDATE_TOAST_ID,
      onDismiss: clearUpdate,
    });
  }, [clearUpdate, reason]);

  return null;
}
