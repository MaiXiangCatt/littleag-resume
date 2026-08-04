import { create } from 'zustand';

import {
  currentBuildInfo,
  isNewerDeployment,
  type BuildInfo,
} from '@/shared/build/model/build-info';

export type BuildUpdateReason = 'new-deployment' | 'stale-assets';

type BuildUpdateState = {
  clearUpdate: () => void;
  markStaleAssets: () => void;
  reason: BuildUpdateReason | null;
  reportDeployedBuild: (buildInfo: BuildInfo) => void;
};

export const useBuildUpdateStore = create<BuildUpdateState>()((set) => ({
  clearUpdate: () => set({ reason: null }),
  markStaleAssets: () => set({ reason: 'stale-assets' }),
  reason: null,
  reportDeployedBuild: (buildInfo) =>
    set((state) => {
      if (state.reason || !isNewerDeployment(currentBuildInfo, buildInfo)) {
        return state;
      }
      return { reason: 'new-deployment' };
    }),
}));
