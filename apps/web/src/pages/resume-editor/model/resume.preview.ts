import type { ResumeSection, SectionType } from './resume.types';

export type ResumeEntryDisplay = {
  date: string;
  description: string;
  title: string;
};

export function sectionHasPrintableContent(section: ResumeSection): boolean {
  if (!section.enabled) return false;
  if (section.type === 'summary') return Boolean(section.text.trim());
  if (section.type === 'skills') return Boolean(section.description.trim());
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
        date,
        description: value('description'),
      };
    case 'education':
      return {
        title: joinHeadline(value('school'), value('major'), value('degree')),
        date,
        description: value('description'),
      };
    case 'project':
      return {
        title: joinHeadline(value('name'), value('role')),
        date,
        description: value('description'),
      };
    case 'awards':
      return {
        title: joinHeadline(value('title'), value('issuer')),
        date: value('date'),
        description: value('description'),
      };
    case 'custom':
      return {
        title: joinHeadline(value('title'), value('subtitle'), value('location')),
        date,
        description: value('description'),
      };
  }
}

function dateRange(start: string, end: string): string {
  return [start, end].filter(Boolean).join(' – ');
}

function joinHeadline(...values: string[]): string {
  return values.filter(Boolean).join('　');
}
