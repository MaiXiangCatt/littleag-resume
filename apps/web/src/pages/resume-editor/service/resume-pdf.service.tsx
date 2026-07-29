import { pdf } from '@react-pdf/renderer';

import type { ResumeDocument } from '../model/resume.types';
import { ResumePdfDocument } from '../ui/ResumePdfDocument';

export async function createResumePdfBlob(resume: ResumeDocument, avatar: string | null) {
  return pdf(<ResumePdfDocument avatar={avatar} resume={resume} />).toBlob();
}
