import { useSyncExternalStore } from 'react';

import { localResumeStore } from '../store/local-resume.store';

export function useLocalResumeStatus() {
  return useSyncExternalStore(localResumeStore.subscribe, localResumeStore.getSnapshot);
}
