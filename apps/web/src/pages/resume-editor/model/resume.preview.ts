import type { ResumeSection, SectionType } from './resume.types';

export const SKILL_LEVEL_LABELS = {
  aware: '了解',
  familiar: '熟悉',
  proficient: '熟练',
  expert: '精通',
} as const;

export type ResumeEntryDisplay = {
  date: string;
  description: string;
  subtitle: string;
  title: string;
};

export function sectionHasPrintableContent(section: ResumeSection): boolean {
  if (!section.enabled) return false;
  if (section.type === 'summary') return Boolean(section.text.trim());
  return section.items.some(itemHasPrintableContent);
}

export function itemHasPrintableContent(item: { id: string }): boolean {
  return Object.entries(item).some(
    ([key, value]) =>
      key !== 'id' && key !== 'isCurrent' && typeof value === 'string' && Boolean(value.trim()),
  );
}

export function getEntryDisplay(
  type: Exclude<SectionType, 'summary' | 'skills'>,
  item: Record<string, unknown>,
): ResumeEntryDisplay {
  const value = (key: string) => (typeof item[key] === 'string' ? (item[key] as string) : '');
  const current = item.isCurrent === true;
  const date = dateRange(value('startDate'), current ? '至今' : value('endDate'));

  switch (type) {
    case 'work':
      return {
        title: joinHeadline(value('company'), value('role'), value('location')),
        subtitle: '',
        date,
        description: value('description'),
      };
    case 'education':
      return {
        title: joinText(value('school'), value('degree')),
        subtitle: value('major'),
        date,
        description: value('description'),
      };
    case 'project':
      return {
        title: value('name'),
        subtitle: value('role'),
        date,
        description: value('description'),
      };
    case 'awards':
      return {
        title: value('title'),
        subtitle: value('issuer'),
        date: value('date'),
        description: value('description'),
      };
    case 'custom':
      return {
        title: value('title'),
        subtitle: joinText(value('subtitle'), value('location')),
        date,
        description: value('description'),
      };
  }
}

function dateRange(start: string, end: string): string {
  return [start, end].filter(Boolean).join(' – ');
}

function joinText(...values: string[]): string {
  return values.filter(Boolean).join(' · ');
}

function joinHeadline(...values: string[]): string {
  return values.filter(Boolean).join('　');
}
