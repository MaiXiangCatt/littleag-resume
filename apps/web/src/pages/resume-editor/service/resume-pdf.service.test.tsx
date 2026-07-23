/// <reference types="node" />

import { resolve } from 'node:path';
import { Font } from '@react-pdf/renderer';
import { beforeAll, describe, expect, it } from 'vitest';

import { createDefaultContent } from '../model/resume.model';
import type { ResumeDocument } from '../model/resume.types';
import { createResumePdfBlob } from './resume-pdf.service';

beforeAll(() => {
  const fontPath = resolve(process.cwd(), 'public/fonts/NotoSansSC-Regular.ttf');
  const serifFontPath = resolve(process.cwd(), 'public/fonts/NotoSerifSC-Variable.ttf');
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
      { fontWeight: 400, src: fontPath },
      { fontWeight: 700, src: fontPath },
      { fontStyle: 'italic', fontWeight: 400, src: fontPath },
      { fontStyle: 'italic', fontWeight: 700, src: fontPath },
    ],
  });
  Font.register({
    family: 'NotoSerifSC',
    fonts: [
      { fontWeight: 400, src: serifFontPath },
      { fontWeight: 700, src: serifFontPath },
      { fontStyle: 'italic', fontWeight: 400, src: serifFontPath },
      { fontStyle: 'italic', fontWeight: 700, src: serifFontPath },
    ],
  });
});

describe('resume PDF service', () => {
  it('generates a PDF containing formatted Markdown', async () => {
    const content = createDefaultContent();
    content.formatting.fontFamily = 'source-han-serif';
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
