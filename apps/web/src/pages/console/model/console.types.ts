import type { ResumeSort } from '@/shared/api/generated/model/resumeSort';
import type { ResumeStatus } from '@/shared/api/generated/model/resumeStatus';

export type ConsoleStatusFilter = 'all' | ResumeStatus;
export type ConsoleSort = ResumeSort;
export type ConsolePageSize = 6 | 12 | 24;

export type ConsoleQueryState = {
  page: number;
  pageSize: ConsolePageSize;
  query: string;
  sort: ConsoleSort;
  status: ConsoleStatusFilter;
};

export type Feedback = {
  kind: 'error' | 'info' | 'success';
  message: string;
};
