import { z } from 'zod';

const id = z.string().min(1);
const text = z.string().max(10_000);
const month = z.string().regex(/^$|^\d{4}-(0[1-9]|1[0-2])$/);
const baseSection = { id, title: z.string().trim().min(1).max(40), enabled: z.boolean() };
const baseItem = { id };

const workItem = z.object({ ...baseItem, company: text, role: text, location: text, startDate: month, endDate: month, isCurrent: z.boolean(), description: text }).strict();
const educationItem = z.object({ ...baseItem, school: text, major: text, degree: text, startDate: month, endDate: month, description: text }).strict();
const projectItem = z.object({ ...baseItem, name: text, role: text, startDate: month, endDate: month, isCurrent: z.boolean(), description: text }).strict();
const skillItem = z.object({ ...baseItem, name: text, level: z.enum(['', 'aware', 'familiar', 'proficient', 'expert']) }).strict();
const awardItem = z.object({ ...baseItem, title: text, issuer: text, date: month, description: text }).strict();
const customItem = z.object({ ...baseItem, title: text, subtitle: text, location: text, startDate: month, endDate: month, isCurrent: z.boolean(), description: text }).strict();

const sectionSchema = z.discriminatedUnion('type', [
  z.object({ ...baseSection, id: z.literal('summary'), type: z.literal('summary'), text }).strict(),
  z.object({ ...baseSection, id: z.literal('work'), type: z.literal('work'), items: z.array(workItem).max(100) }).strict(),
  z.object({ ...baseSection, id: z.literal('education'), type: z.literal('education'), items: z.array(educationItem).max(100) }).strict(),
  z.object({ ...baseSection, id: z.literal('project'), type: z.literal('project'), items: z.array(projectItem).max(100) }).strict(),
  z.object({ ...baseSection, id: z.literal('skills'), type: z.literal('skills'), items: z.array(skillItem).max(100) }).strict(),
  z.object({ ...baseSection, id: z.literal('awards'), type: z.literal('awards'), items: z.array(awardItem).max(100) }).strict(),
  z.object({ ...baseSection, type: z.literal('custom'), items: z.array(customItem).max(100) }).strict(),
]);

export const resumeContentSchema = z.object({
  profile: z.object({
    fullName: text,
    targetRole: text,
    phone: text,
    email: text,
    location: text,
    links: z.array(z.object({ id, label: text, url: text }).strict()).max(20),
  }).strict(),
  sections: z.array(sectionSchema).max(64),
  formatting: z.object({
    fontSize: z.enum(['small', 'standard', 'large']),
    lineHeight: z.enum(['compact', 'standard', 'relaxed']),
    pageMargin: z.enum(['narrow', 'standard', 'wide']),
    sectionGap: z.enum(['compact', 'standard', 'relaxed']),
    accentColor: z.enum(['plum', 'navy', 'teal', 'rust', 'charcoal']),
  }).strict(),
}).strict().superRefine((content, context) => {
  const ids = new Set<string>();
  const builtinTypes = new Set<string>();
  for (const section of content.sections) {
    if (ids.has(section.id)) context.addIssue({ code: 'custom', message: '板块 ID 重复' });
    ids.add(section.id);
    if (section.type !== 'custom') {
      if (builtinTypes.has(section.type)) context.addIssue({ code: 'custom', message: '内置板块重复' });
      builtinTypes.add(section.type);
    }
  }
});

export const importEnvelopeSchema = z.object({
  version: z.literal(1),
  title: z.string().trim().min(1).max(80),
  templateId: z.enum(['modern-editorial', 'classic-professional']),
  avatar: z.string().startsWith('data:image/jpeg;base64,').max(750_000).nullish(),
  content: resumeContentSchema,
}).strict();

