import type { ResumeContent } from '@/shared/api/generated/model/resumeContent';

import { importEnvelopeSchema, resumeContentSchema } from './resume.schema';
import type {
  AccentColor,
  CustomItem,
  PresetAccentColor,
  ResumeContentV2,
  ResumeFontFamily,
  ResumeFormatting,
  ResumeImportEnvelope,
  ResumeSection,
  SectionType,
} from './resume.types';

export const BUILTIN_TITLES: Record<Exclude<SectionType, 'custom'>, string> = {
  summary: '个人简介',
  work: '工作经历',
  education: '教育背景',
  project: '项目经历',
  skills: '技能',
  awards: '奖项荣誉',
};

export const ACCENT_COLORS: Record<PresetAccentColor, string> = {
  plum: '#850477',
  navy: '#1f3a5f',
  teal: '#147d73',
  rust: '#a3482b',
  charcoal: '#374151',
  black: '#000000',
};

export const RESUME_FONT_FAMILIES: Record<
  ResumeFontFamily,
  { cssFamily: string; label: string; pdfFamily: string }
> = {
  'source-han-sans': {
    cssFamily: "'Noto Sans SC', 'PingFang SC', sans-serif",
    label: '思源黑体',
    pdfFamily: 'NotoSansSC',
  },
  'source-han-serif': {
    cssFamily: "'Noto Serif SC', 'Songti SC', serif",
    label: '思源宋体',
    pdfFamily: 'NotoSerifSC',
  },
};

export function resolveAccentColor(value: AccentColor): string {
  return value.startsWith('#') ? value : ACCENT_COLORS[value as PresetAccentColor];
}

export function createDefaultFormatting(): ResumeFormatting {
  return {
    nameFontSizePx: 20,
    sectionTitleFontSizePx: 16,
    entryTitleFontSizePx: 14,
    bodyFontSizePx: 14,
    lineHeightRatio: 1.5,
    pageMarginPx: { top: 33, right: 33, bottom: 33, left: 33 },
    sectionGapPx: 8,
    fontFamily: 'source-han-sans',
    accentColor: 'plum',
  };
}

export function createDefaultContent(): ResumeContentV2 {
  return {
    profile: { fullName: '', targetRole: '', phone: '', email: '', location: '', links: [] },
    sections: [
      { id: 'summary', type: 'summary', title: '个人简介', enabled: true, text: '' },
      { id: 'work', type: 'work', title: '工作经历', enabled: true, items: [] },
      { id: 'education', type: 'education', title: '教育背景', enabled: true, items: [] },
      { id: 'project', type: 'project', title: '项目经历', enabled: true, items: [] },
      { id: 'skills', type: 'skills', title: '技能', enabled: true, description: '' },
      { id: 'awards', type: 'awards', title: '奖项荣誉', enabled: false, items: [] },
    ],
    formatting: createDefaultFormatting(),
  };
}

export function parseResumeContent(value: ResumeContent | unknown): ResumeContentV2 {
  return resumeContentSchema.parse(value);
}

export function parseImportEnvelope(value: unknown): ResumeImportEnvelope {
  return importEnvelopeSchema.parse(value);
}

export function createCustomSection(title: string): ResumeSection {
  return {
    id: crypto.randomUUID(),
    type: 'custom',
    title: title.trim(),
    enabled: true,
    items: [createSectionItem('custom') as CustomItem],
  };
}

export function createSectionItem(type: Exclude<SectionType, 'summary' | 'skills'>) {
  const id = crypto.randomUUID();
  switch (type) {
    case 'work':
      return {
        id,
        company: '',
        role: '',
        location: '',
        startDate: '',
        endDate: '',
        isCurrent: false,
        description: '',
      };
    case 'education':
      return { id, school: '', major: '', degree: '', startDate: '', endDate: '', description: '' };
    case 'project':
      return {
        id,
        name: '',
        role: '',
        startDate: '',
        endDate: '',
        isCurrent: false,
        description: '',
      };
    case 'awards':
      return { id, title: '', issuer: '', date: '', description: '' };
    case 'custom':
      return {
        id,
        title: '',
        subtitle: '',
        location: '',
        startDate: '',
        endDate: '',
        isCurrent: false,
        description: '',
      };
  }
}

export function moveById<T extends { id: string }>(items: T[], activeId: string, overId: string) {
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function completionIssues(content: ResumeContentV2) {
  const issues: string[] = [];
  if (!content.profile.fullName.trim()) issues.push('请填写姓名');
  if (!content.profile.targetRole.trim()) issues.push('请填写目标岗位');
  for (const section of content.sections) {
    if (!section.enabled || section.type === 'summary' || section.type === 'skills') continue;
    for (const item of section.items) {
      if (
        section.type === 'work' &&
        !('company' in item && item.company.trim() && item.role.trim())
      )
        issues.push(`${section.title}中有未完成记录`);
      if (section.type === 'education' && !('school' in item && item.school.trim()))
        issues.push(`${section.title}中有未完成记录`);
      if (section.type === 'project' && !('name' in item && item.name.trim()))
        issues.push(`${section.title}中有未完成记录`);
      if (
        (section.type === 'awards' || section.type === 'custom') &&
        !('title' in item && item.title.trim())
      )
        issues.push(`${section.title}中有未完成记录`);
    }
  }
  return [...new Set(issues)];
}
