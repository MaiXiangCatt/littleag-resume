import { memo, type CSSProperties } from 'react';

import { Card } from '@/shared/ui/card';
import { Link } from '@/shared/ui/link';
import { cn } from '@/shared/lib/utils';

import { RESUME_FONT_FAMILIES, resolveAccentColor } from '../model/resume.model';
import {
  getEntryDisplay,
  itemHasPrintableContent,
  sectionHasPrintableContent,
} from '../model/resume.preview';
import type { ResumeDocument, ResumeFormatting, ResumeSection } from '../model/resume.types';
import { ResumeMarkdownHtml } from './ResumeMarkdownHtml';

type ResumeHtmlPreviewProps = {
  avatar: string | null;
  resume: ResumeDocument;
};

export const ResumeHtmlPreview = memo(function ResumeHtmlPreview({
  avatar,
  resume,
}: ResumeHtmlPreviewProps) {
  const formatting = resume.content.formatting;
  const profile = resume.content.profile;
  const isClassic = resume.templateId === 'classic-professional';
  const accent = resolveAccentColor(formatting.accentColor);
  const style = {
    '--resume-accent': accent,
    containerType: 'inline-size',
    fontFamily: RESUME_FONT_FAMILIES[formatting.fontFamily].cssFamily,
    fontSize: `${formatting.bodyFontSizePx}px`,
    lineHeight: formatting.lineHeightRatio,
  } as CSSProperties;
  const contacts = [profile.phone, profile.email, profile.location].filter(Boolean);
  const printableLinks = profile.links.filter((link) => link.label && link.url);

  return (
    <Card
      aria-label={`${resume.title} A4 实时预览`}
      className={cn(
        'mx-auto w-full max-w-[794px] shrink-0 gap-0 rounded-[2px] border-0 bg-white py-0 text-[#242126] shadow-[0_26px_70px_rgba(31,24,29,0.24)]',
      )}
      data-template={resume.templateId}
      style={style}
    >
      <article
        className="min-h-[141.428cqw]"
        style={{
          paddingBottom: formatting.pageMarginPx.bottom,
          paddingLeft: formatting.pageMarginPx.left,
          paddingRight: formatting.pageMarginPx.right,
          paddingTop: formatting.pageMarginPx.top,
        }}
      >
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
                  className="font-bold leading-[1.08] tracking-[-0.02em]"
                  style={{
                    color: isClassic ? '#202027' : accent,
                    fontSize: formatting.nameFontSizePx,
                  }}
                >
                  {profile.fullName}
                </h1>
              ) : null}
              {profile.targetRole ? (
                <p
                  className="mt-[0.45em]"
                  style={{ color: '#242126', fontSize: formatting.bodyFontSizePx }}
                >
                  {`求职意向：${profile.targetRole}`}
                </p>
              ) : null}
              {contacts.length || printableLinks.length ? (
                <div
                  className={cn(
                    'mt-[0.8em] flex flex-wrap gap-x-[1em] gap-y-[0.35em]',
                    isClassic ? 'justify-center' : 'justify-start',
                  )}
                  style={{ color: '#242126', fontSize: formatting.bodyFontSizePx }}
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
            formatting={formatting}
          />
        ))}
      </article>
    </Card>
  );
});

function HtmlSection({
  isClassic,
  section,
  formatting,
}: {
  isClassic: boolean;
  section: ResumeSection;
  formatting: ResumeFormatting;
}) {
  return (
    <section className="break-inside-avoid" style={{ marginTop: formatting.sectionGapPx }}>
      <h2
        className={cn(
          'border-b pb-[0.35em] font-bold tracking-[0.04em]',
          isClassic ? 'text-[#27242a]' : 'text-[var(--resume-accent)]',
        )}
        style={{
          borderColor: isClassic ? '#b9b4bc' : 'var(--resume-accent)',
          fontSize: formatting.sectionTitleFontSizePx,
        }}
      >
        {section.title}
      </h2>
      {section.type === 'summary' ? (
        <ResumeMarkdownHtml className="mt-[0.8em]" value={section.text} />
      ) : null}
      {section.type === 'skills' ? (
        <ResumeMarkdownHtml className="mt-[0.8em]" value={section.description} />
      ) : null}
      {section.type !== 'summary' && section.type !== 'skills' ? (
        <div className="space-y-[1em] pt-[0.8em]">
          {section.items.filter(itemHasPrintableContent).map((item) => {
            const display = getEntryDisplay(
              section.type,
              item as unknown as Record<string, unknown>,
            );
            return (
              <article className="break-inside-avoid" key={item.id}>
                {display.title || display.date ? (
                  <div className="flex items-baseline justify-between gap-[1.5em]">
                    {display.title ? (
                      <h3
                        className="font-bold"
                        style={{ fontSize: formatting.entryTitleFontSizePx }}
                      >
                        {display.title}
                      </h3>
                    ) : (
                      <span />
                    )}
                    {display.date ? (
                      <time
                        className="shrink-0"
                        style={{ fontSize: formatting.entryTitleFontSizePx }}
                      >
                        {display.date}
                      </time>
                    ) : null}
                  </div>
                ) : null}
                {display.description.trim() ? (
                  <ResumeMarkdownHtml className="mt-[0.45em]" value={display.description} />
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
