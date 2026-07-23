import { describe, expect, it } from 'vitest';

import {
  completionIssues,
  createCustomSection,
  createDefaultContent,
  descriptionLines,
  moveById,
  normalizeContent,
  parseImportEnvelope,
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
    expect(content.formatting.accentColor).toBe('plum');
  });

  it('normalizes legacy empty content without sharing mutable defaults', () => {
    const first = normalizeContent({});
    const second = normalizeContent({});

    first.profile.fullName = 'Ada';
    expect(second.profile.fullName).toBe('');
  });

  it('strictly rejects unknown import fields and malformed dates', () => {
    const content = createDefaultContent();
    const envelope = { version: 1, title: 'Resume', templateId: 'modern-editorial', content };

    expect(() => parseImportEnvelope({ ...envelope, unknown: true })).toThrow();
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

  it('supports multiple custom sections, stable reordering and line bullets', () => {
    const first = createCustomSection('志愿经历');
    const second = createCustomSection('出版作品');

    expect(first.id).not.toBe(second.id);
    expect(moveById([first, second], second.id, first.id).map((section) => section.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(descriptionLines('  first\n\n second  \r\n')).toEqual(['first', 'second']);
  });

  it('allows drafts but reports completion requirements', () => {
    const content = createDefaultContent();

    expect(completionIssues(content)).toEqual(['请填写姓名', '请填写目标岗位']);
    content.profile.fullName = 'Ada';
    content.profile.targetRole = 'Engineer';
    expect(completionIssues(content)).toEqual([]);
  });
});
