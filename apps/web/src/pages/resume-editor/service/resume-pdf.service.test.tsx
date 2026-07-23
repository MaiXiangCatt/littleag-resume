/// <reference types="node" />

import { resolve } from 'node:path';
import { Font } from '@react-pdf/renderer';
import { beforeAll, describe, expect, it } from 'vitest';

import { createDefaultContent } from '../model/resume.model';
import type { ResumeDocument } from '../model/resume.types';
import { createResumePdfBlob } from './resume-pdf.service';

beforeAll(() => {
  const sansRegularPath = resolve(process.cwd(), 'public/fonts/NotoSansSC-Regular.ttf');
  const serifRegularPath = resolve(process.cwd(), 'public/fonts/NotoSerifSC-Variable.ttf');
  Font.clear();
  Font.register({
    family: 'Helvetica',
    fonts: [
      { fontWeight: 400, src: 'Helvetica' },
      { fontWeight: 700, src: 'Helvetica-Bold' },
      { fontStyle: 'italic', fontWeight: 400, src: 'Helvetica-Oblique' },
      { fontStyle: 'italic', fontWeight: 700, src: 'Helvetica-BoldOblique' },
    ],
  });
  Font.register({
    family: 'NotoSansSC',
    fonts: [
      { fontWeight: 400, src: sansRegularPath },
      { fontWeight: 700, src: sansRegularPath },
      { fontStyle: 'italic', fontWeight: 400, src: sansRegularPath },
      { fontStyle: 'italic', fontWeight: 700, src: sansRegularPath },
    ],
  });
  Font.register({
    family: 'NotoSerifSC',
    fonts: [
      { fontWeight: 400, src: serifRegularPath },
      { fontWeight: 700, src: serifRegularPath },
      { fontStyle: 'italic', fontWeight: 400, src: serifRegularPath },
      { fontStyle: 'italic', fontWeight: 700, src: serifRegularPath },
    ],
  });
});

describe('resume PDF service', () => {
  it('generates a PDF containing formatted Markdown', async () => {
    const content = createDefaultContent();
    content.formatting.fontFamily = 'source-han-serif';
    content.profile = {
      fullName: '林清清',
      targetRole: '前端开发工程师',
      phone: '13800000000',
      email: 'qingqing@example.com',
      location: '杭州',
      links: [],
    };
    const summary = content.sections.find((section) => section.type === 'summary');
    if (summary?.type === 'summary') {
      summary.text = '负责**设计系统**\n\n- 建立规范\n- 推动交付';
    }
    const skills = content.sections.find((section) => section.type === 'skills');
    if (skills?.type === 'skills') {
      skills.description = '- **TypeScript**：熟练\n- React：熟悉组件设计';
    }
    const resume: ResumeDocument = {
      id: 'resume-1',
      title: 'Markdown 简历',
      status: 'draft',
      revision: 1,
      hasAvatar: false,
      templateId: 'modern-editorial',
      exportCount: 0,
      contentVersion: 2,
      content,
      createdAt: '2026-07-23T00:00:00Z',
      updatedAt: '2026-07-23T00:00:00Z',
    };

    const blob = await createResumePdfBlob(resume, null);

    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1_000);
  }, 20_000);
});
