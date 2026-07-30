import type { LocalResumeListQuery } from '@/pages/resume-editor/model/local-resume';
import { localResumeStore } from '@/pages/resume-editor/store/local-resume.store';

import type { ConsoleDataSource } from '../model/console.types';

export const localConsoleService: ConsoleDataSource = {
  copy: (resumeId) => localResumeStore.copy(resumeId),
  create: (title) => localResumeStore.create(title),
  delete: async (resumeId) => {
    await localResumeStore.delete(resumeId);
  },
  import: (input) => localResumeStore.import(input),
  list: (query) => localResumeStore.list(query as LocalResumeListQuery),
  stats: () => localResumeStore.stats(),
  updateTitle: (resumeId, expectedRevision, title) =>
    localResumeStore.updateTitle(resumeId, expectedRevision, title),
};
