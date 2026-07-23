import type { ResumePrintPayload } from '@/shared/api/generated/model/resumePrintPayload';
import { httpRequest } from '@/shared/http/http.client';

import { toDocument } from '@/pages/resume-editor/service/resume-editor.service';

export const printService = {
  async getPrintData(resumeId: string, token: string) {
    const payload = await httpRequest<ResumePrintPayload>(
      `/api/resumes/${resumeId}/print?token=${encodeURIComponent(token)}`,
      { skipAuth: true, skipRefreshRetry: true },
    );
    return {
      document: toDocument(payload.resume),
      avatar: payload.avatarDataUrl ?? null,
    };
  },
};
