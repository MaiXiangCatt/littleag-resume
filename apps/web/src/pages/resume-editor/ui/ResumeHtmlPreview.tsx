import { memo, type CSSProperties } from 'react';

import { Card } from '@/shared/ui/card';
import { Link } from '@/shared/ui/link';
import { cn } from '@/shared/lib/utils';

import { ACCENT_COLORS, descriptionLines } from '../model/resume.model';
import {
  getEntryDisplay,
  itemHasPrintableContent,
  sectionHasPrintableContent,
  SKILL_LEVEL_LABELS,
} from '../model/resume.preview';
import type { ResumeDocument, ResumeSection } from '../model/resume.types';

type ResumeHtmlPreviewProps = {
  avatar: string | null;
  resume: ResumeDocument;
};

const fontSizeClasses = {
  small: 'text-[10px]',
  standard: 'text-[11px]',
  large: 'text-xs',
} as const;

const lineHeightClasses = {
  compact: 'leading-[1.25]',
  standard: 'leading-[1.42]',
  relaxed: 'leading-[1.62]',
} as const;

const marginClasses = {
  narrow: 'p-[4.8%]',
  standard: 'p-[6.4%]',
  wide: 'p-[8.4%]',
} as const;

const sectionGapClasses = {
  compact: 'mt-[1.5em]',
  standard: 'mt-[2.15em]',
  relaxed: 'mt-[3em]',
} as const;

export const ResumeHtmlPreview = memo(function ResumeHtmlPreview({
  avatar,
  resume,
}: ResumeHtmlPreviewProps) {
  const formatting = resume.content.formatting;
  const profile = resume.content.profile;
  const isClassic = resume.templateId === 'classic-professional';
  const accent = ACCENT_COLORS[formatting.accentColor];
  const style = { '--resume-accent': accent, containerType: 'inline-size' } as CSSProperties;
  const contacts = [profile.phone, profile.email, profile.location].filter(Boolean);
  const printableLinks = profile.links.filter((link) => link.label && link.url);

  return (
    <Card
      aria-label={`${resume.title} A4 实时预览`}
      className={cn(
        'mx-auto w-full max-w-[794px] shrink-0 gap-0 rounded-[2px] border-0 bg-white py-0 text-[#242126] shadow-[0_26px_70px_rgba(31,24,29,0.24)]',
        fontSizeClasses[formatting.fontSize],
        lineHeightClasses[formatting.lineHeight],
      )}
      data-template={resume.templateId}
      style={style}
    >
      <article className={cn('min-h-[141.428cqw]', marginClasses[formatting.pageMargin])}>
        {profile.fullName ||
        profile.targetRole ||
        contacts.length ||
        profile.links.length ||
        avatar ? (
          <header
            className={cn(
              'flex border-b pb-[1.4em]',
              avatar ? 'flex-row items-start justify-between' : 'flex-col',
              isClassic ? 'border-b text-center' : 'border-b-[3px] text-left',
            )}
            style={{ borderColor: isClassic ? '#b9b4bc' : accent }}
          >
            <div className={cn('min-w-0 flex-1', isClassic ? 'text-center' : 'text-left')}>
              {profile.fullName ? (
                <h1
                  className="font-serif text-[2.65em] font-bold leading-[1.08] tracking-[-0.02em]"
                  style={{ color: isClassic ? '#202027' : accent }}
                >
                  {profile.fullName}
                </h1>
              ) : null}
              {profile.targetRole ? (
                <p className="mt-[0.45em] text-[1.18em] text-[#5d5962]">{profile.targetRole}</p>
              ) : null}
              {contacts.length || printableLinks.length ? (
                <div
                  className={cn(
                    'mt-[0.8em] flex flex-wrap gap-x-[1em] gap-y-[0.35em] text-[0.82em] text-[#77717a]',
                    isClassic ? 'justify-center' : 'justify-start',
                  )}
                >
                  {contacts.map((value) => (
                    <span key={value}>{value}</span>
                  ))}
                  {printableLinks.map((link) => (
                    <Link
                      className="text-inherit no-underline hover:underline"
                      href={link.url}
                      key={link.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
            {avatar ? (
              <img
                alt=""
                className={cn(
                  'ml-[2em] size-[7.2em] shrink-0 object-cover',
                  isClassic ? 'rounded-full' : 'rounded-md',
                )}
                src={avatar}
              />
            ) : null}
          </header>
        ) : null}

        {resume.content.sections.filter(sectionHasPrintableContent).map((section) => (
          <HtmlSection
            isClassic={isClassic}
            key={section.id}
            section={section}
            sectionGap={formatting.sectionGap}
          />
        ))}
      </article>
    </Card>
  );
});

function HtmlSection({
  isClassic,
  section,
  sectionGap,
}: {
  isClassic: boolean;
  section: ResumeSection;
  sectionGap: keyof typeof sectionGapClasses;
}) {
  return (
    <section className={cn('break-inside-avoid', sectionGapClasses[sectionGap])}>
      <h2
        className={cn(
          'border-b pb-[0.35em] text-[1.18em] font-bold tracking-[0.04em]',
          isClassic ? 'text-[#27242a]' : 'text-[var(--resume-accent)]',
        )}
        style={{ borderColor: isClassic ? '#b9b4bc' : 'var(--resume-accent)' }}
      >
        {section.title}
      </h2>
      {section.type === 'summary' ? (
        <p className="mt-[0.8em] whitespace-pre-line">{section.text}</p>
      ) : null}
      {section.type === 'skills' ? (
        <div className="mt-[0.8em] flex flex-wrap gap-[0.65em]">
          {section.items
            .filter((item) => item.name.trim())
            .map((item) => (
              <span
                className={cn(
                  'inline-flex items-center gap-[0.4em] border px-[0.8em] py-[0.35em]',
                  isClassic
                    ? 'rounded-sm border-[#d6d2d5] bg-[#f3f1f2] text-[#38343a]'
                    : 'rounded-full bg-[color-mix(in_srgb,var(--resume-accent)_7%,white)] text-[var(--resume-accent)]',
                )}
                key={item.id}
                style={
                  isClassic
                    ? undefined
                    : { borderColor: 'color-mix(in srgb, var(--resume-accent) 28%, white)' }
                }
              >
                <span>{item.name}</span>
                {item.level ? (
                  <span className="opacity-75">· {SKILL_LEVEL_LABELS[item.level]}</span>
                ) : null}
              </span>
            ))}
        </div>
      ) : null}
      {section.type !== 'summary' && section.type !== 'skills' ? (
        <div className="space-y-[1em] pt-[0.8em]">
          {section.items.filter(itemHasPrintableContent).map((item) => {
            const display = getEntryDisplay(
              section.type,
              item as unknown as Record<string, unknown>,
            );
            const bullets = descriptionLines(display.description);
            return (
              <article className="break-inside-avoid" key={item.id}>
                {display.title || display.date ? (
                  <div className="flex items-baseline justify-between gap-[1.5em]">
                    {display.title ? <h3 className="font-bold">{display.title}</h3> : <span />}
                    {display.date ? (
                      <time className="shrink-0 text-[0.82em] text-[#6f6972]">{display.date}</time>
                    ) : null}
                  </div>
                ) : null}
                {display.subtitle ? (
                  <p className="mt-[0.15em] text-[0.82em] text-[#6f6972]">{display.subtitle}</p>
                ) : null}
                {bullets.length ? (
                  <ul className="mt-[0.45em] space-y-[0.18em]">
                    {bullets.map((line, index) => (
                      <li className="flex gap-[0.65em]" key={`${index}-${line}`}>
                        <span aria-hidden="true" className="text-[var(--resume-accent)]">
                          •
                        </span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
