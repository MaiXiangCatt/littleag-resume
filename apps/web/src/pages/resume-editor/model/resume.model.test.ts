import { describe, expect, it } from 'vitest';

import {
  completionIssues,
  createCustomSection,
  createDefaultContent,
  moveById,
  parseImportEnvelope,
  parseResumeContent,
} from './resume.model';

describe('resume editor model', () => {
  it('creates the default built-in catalog with awards disabled', () => {
    const content = createDefaultContent();

    expect(content.sections.map(({ id, enabled }) => [id, enabled])).toEqual([
      ['summary', true],
      ['work', true],
      ['education', true],
      ['project', true],
      ['skills', true],
      ['awards', false],
    ]);
    expect(content.sections.find((section) => section.type === 'skills')).toMatchObject({
      description: '',
    });
    expect(content.formatting).toEqual({
      nameFontSizePx: 20,
      sectionTitleFontSizePx: 16,
      entryTitleFontSizePx: 14,
      bodyFontSizePx: 14,
      lineHeightRatio: 1.5,
      pageMarginPx: { top: 33, right: 33, bottom: 33, left: 33 },
      sectionGapPx: 8,
      fontFamily: 'source-han-sans',
      accentColor: 'plum',
    });
  });

  it('rejects legacy and out-of-range formatting', () => {
    const content = createDefaultContent();
    expect(() =>
      parseResumeContent({
        ...content,
        formatting: {
          fontSize: 'standard',
          lineHeight: 'standard',
          pageMargin: 'standard',
          sectionGap: 'standard',
          accentColor: 'plum',
        },
      }),
    ).toThrow();
    expect(() =>
      parseResumeContent({
        ...content,
        formatting: { ...content.formatting, bodyFontSizePx: 25 },
      }),
    ).toThrow();
    expect(() =>
      parseResumeContent({
        ...content,
        formatting: { ...content.formatting, accentColor: '#12xyz9' },
      }),
    ).toThrow();
    expect(
      parseResumeContent({
        ...content,
        formatting: {
          ...content.formatting,
          fontFamily: 'source-han-serif',
          accentColor: '#123abc',
        },
      }).formatting,
    ).toMatchObject({ fontFamily: 'source-han-serif', accentColor: '#123abc' });
  });

  it('strictly rejects unknown import fields and malformed dates', () => {
    const content = createDefaultContent();
    const envelope = { version: 2, title: 'Resume', templateId: 'modern-editorial', content };

    expect(() => parseImportEnvelope({ ...envelope, unknown: true })).toThrow();
    expect(() => parseImportEnvelope({ ...envelope, version: 1 })).toThrow();
    const work = content.sections.find((section) => section.type === 'work');
    if (!work || work.type !== 'work') throw new Error('missing work section');
    work.items.push({
      id: crypto.randomUUID(),
      company: '',
      role: '',
      location: '',
      startDate: '2026-13',
      endDate: '',
      isCurrent: false,
      description: '',
    });
    expect(() => parseImportEnvelope(envelope)).toThrow();
  });

  it('rejects the legacy structured skills format', () => {
    const content = createDefaultContent();
    const legacySkills = {
      id: 'skills',
      type: 'skills',
      title: '技能',
      enabled: true,
      items: [{ id: 'skill-1', name: 'TypeScript', level: 'proficient' }],
    };

    expect(() =>
      parseResumeContent({
        ...content,
        sections: content.sections.map((section) =>
          section.type === 'skills' ? legacySkills : section,
        ),
      }),
    ).toThrow();
  });

  it('supports multiple custom sections and stable reordering', () => {
    const first = createCustomSection('志愿经历');
    const second = createCustomSection('出版作品');

    expect(first.id).not.toBe(second.id);
    expect(moveById([first, second], second.id, first.id).map((section) => section.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it('allows drafts but reports completion requirements', () => {
    const content = createDefaultContent();

    expect(completionIssues(content)).toEqual(['请填写姓名', '请填写目标岗位']);
    content.profile.fullName = 'Ada';
    content.profile.targetRole = 'Engineer';
    expect(completionIssues(content)).toEqual([]);
  });
});
