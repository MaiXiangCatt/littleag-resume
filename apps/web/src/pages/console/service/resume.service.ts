import type { ImportResumeRequest } from '@/shared/api/generated/model/importResumeRequest';
import type { ResumeDetail } from '@/shared/api/generated/model/resumeDetail';
import type { ResumeListPayload } from '@/shared/api/generated/model/resumeListPayload';
import type { ResumeSort } from '@/shared/api/generated/model/resumeSort';
import type { ResumeStats } from '@/shared/api/generated/model/resumeStats';
import type { ResumeStatus } from '@/shared/api/generated/model/resumeStatus';
import type { UpdateResumeRequest } from '@/shared/api/generated/model/updateResumeRequest';
import { ApiError, httpRequest } from '@/shared/http/http.client';

export type ResumeListQuery = {
  page: number;
  pageSize: 6 | 12 | 24;
  query: string;
  sort: ResumeSort;
  status?: ResumeStatus;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const resumeService = {
  list(query: ResumeListQuery, signal?: AbortSignal) {
    const search = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
      sort: query.sort,
    });
    const normalizedQuery = query.query.trim();
    if (normalizedQuery) {
      search.set('query', normalizedQuery);
    }
    if (query.status) {
      search.set('status', query.status);
    }
    return httpRequest<ResumeListPayload>(`/api/resumes?${search.toString()}`, { signal });
  },

  stats(signal?: AbortSignal) {
    return httpRequest<ResumeStats>('/api/resumes/stats', { signal });
  },

  create(title?: string) {
    return httpRequest<ResumeDetail>('/api/resumes', {
      body: JSON.stringify(title ? { title } : {}),
      headers: JSON_HEADERS,
      method: 'POST',
    });
  },

  update(resumeId: string, input: UpdateResumeRequest) {
    return httpRequest<ResumeDetail>(`/api/resumes/${resumeId}`, {
      body: JSON.stringify(input),
      headers: JSON_HEADERS,
      method: 'PATCH',
    });
  },

  copy(resumeId: string) {
    return httpRequest<ResumeDetail>(`/api/resumes/${resumeId}/copy`, { method: 'POST' });
  },

  delete(resumeId: string) {
    return httpRequest<null>(`/api/resumes/${resumeId}`, { method: 'DELETE' });
  },

  import(input: ImportResumeRequest) {
    return httpRequest<ResumeDetail>('/api/resumes/import', {
      body: JSON.stringify(input),
      headers: JSON_HEADERS,
      method: 'POST',
    });
  },
};

const resumeErrorMessages: Record<number, string> = {
  100001: '请求参数不正确，请检查后重试',
  100003: '登录状态已失效，请重新登录',
  103001: '这份简历不存在或已被删除',
  103004: '简历文件格式不正确',
  105002: '简历文件不能超过 2 MB',
  106002: 'PDF 服务繁忙，请稍后重试',
};

export function resumeErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return resumeErrorMessages[error.code] ?? error.message ?? '操作失败，请稍后重试';
  }
  return '网络开小差了，请稍后重试';
}
