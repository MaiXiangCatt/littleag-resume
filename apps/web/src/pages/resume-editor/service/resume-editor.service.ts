import type { ResumeDetail } from '@/shared/api/generated/model/resumeDetail';
import type { ResumeContent } from '@/shared/api/generated/model/resumeContent';
import { httpBlobRequest, httpRequest } from '@/shared/http/http.client';

import type {
  ResumeDocument,
  ResumeImportEnvelope,
  ResumeStatus,
  TemplateId,
} from '../model/resume.types';
import { parseResumeContent } from '../model/resume.model';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export class UnsupportedResumeContentError extends Error {
  constructor() {
    super('这份简历使用旧版内容格式，请删除后重新创建');
    this.name = 'UnsupportedResumeContentError';
  }
}

export function toDocument(detail: ResumeDetail): ResumeDocument {
  if (detail.contentVersion !== 2) throw new UnsupportedResumeContentError();
  return {
    ...detail,
    templateId: (detail.templateId ?? 'modern-editorial') as TemplateId,
    status: detail.status as ResumeStatus,
    contentVersion: 2,
    content: parseResumeContent(detail.content),
  };
}

export const resumeEditorService = {
  async get(resumeId: string) {
    return toDocument(await httpRequest<ResumeDetail>(`/api/resumes/${resumeId}`));
  },

  async update(document: ResumeDocument, expectedRevision = document.revision) {
    const detail = await httpRequest<ResumeDetail>(`/api/resumes/${document.id}`, {
      body: JSON.stringify({
        expectedRevision,
        title: document.title,
        status: document.status,
        templateId: document.templateId,
        content: document.content as unknown as ResumeContent,
      }),
      headers: JSON_HEADERS,
      method: 'PATCH',
    });
    return toDocument(detail);
  },

  async replaceImport(resumeId: string, revision: number, envelope: ResumeImportEnvelope) {
    const detail = await httpRequest<ResumeDetail>(`/api/resumes/${resumeId}/import`, {
      body: JSON.stringify({ ...envelope, expectedRevision: revision }),
      headers: JSON_HEADERS,
      method: 'PUT',
    });
    return toDocument(detail);
  },

  async putAvatar(resumeId: string, avatar: Blob) {
    const detail = await httpRequest<ResumeDetail>(`/api/resumes/${resumeId}/avatar`, {
      body: avatar,
      headers: { 'Content-Type': 'image/jpeg' },
      method: 'PUT',
    });
    return toDocument(detail);
  },

  async getAvatar(resumeId: string) {
    return httpBlobRequest(`/api/resumes/${resumeId}/avatar`);
  },

  async deleteAvatar(resumeId: string) {
    const detail = await httpRequest<ResumeDetail>(`/api/resumes/${resumeId}/avatar`, {
      method: 'DELETE',
    });
    return toDocument(detail);
  },

  async exportPdf(resumeId: string) {
    return httpBlobRequest(`/api/resumes/${resumeId}/export/pdf`, { method: 'POST' });
  },
};
