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
import { createResumePresentation, formatTargetRole } from '../model/resume.presentation';
import type { ResumeDocument, ResumeFormatting, ResumeSection } from '../model/resume.types';
import { ResumeMarkdownHtml } from './ResumeMarkdownHtml';

type ResumeHtmlPreviewProps = {
  avatar: string | null;
  resume: ResumeDocument;
  mode?: 'screen' | 'print';
};

export const ResumeHtmlPreview = memo(function ResumeHtmlPreview({
  avatar,
  resume,
  mode = 'screen',
}: ResumeHtmlPreviewProps) {
  const isPrint = mode === 'print';
  const formatting = resume.content.formatting;
  const profile = resume.content.profile;
  const isClassic = resume.templateId === 'classic-professional';
  const accent = resolveAccentColor(formatting.accentColor);
  const presentation = createResumePresentation(formatting, isClassic);
  const hasCenteredAvatar = isClassic && Boolean(avatar);
  const style = {
    '--resume-accent': accent,
    ...(isPrint ? {} : { containerType: 'inline-size' }),
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
        'mx-auto w-full shrink-0 gap-0 border-0 bg-white py-0 text-[#242126]',
        isPrint
          ? 'max-w-none rounded-none shadow-none'
          : 'max-w-[794px] rounded-[2px] shadow-[0_26px_70px_rgba(31,24,29,0.24)]',
      )}
      data-template={resume.templateId}
      style={style}
    >
      <article
        className={isPrint ? undefined : 'min-h-[141.428cqw]'}
        style={
          // 打印模式的页边距由 @page margin 承担，article 不再加 padding，
          // 否则第 2 页起上下边距会丢失。
          isPrint
            ? undefined
            : {
                paddingBottom: formatting.pageMarginPx.bottom,
                paddingLeft: formatting.pageMarginPx.left,
                paddingRight: formatting.pageMarginPx.right,
                paddingTop: formatting.pageMarginPx.top,
              }
        }
      >
        {profile.fullName ||
        profile.targetRole ||
        contacts.length ||
        profile.links.length ||
        avatar ? (
          <header
            className={cn(
              'flex',
              hasCenteredAvatar && 'relative flex-col',
              avatar && !hasCenteredAvatar && 'flex-row items-start justify-between',
              !avatar && 'flex-col',
              isClassic ? 'text-center' : 'text-left',
            )}
            style={{
              minHeight: hasCenteredAvatar
                ? presentation.photoHeightPx + presentation.headerPaddingBottomPx
                : undefined,
              paddingBottom: presentation.headerPaddingBottomPx,
            }}
          >
            <div
              className={cn('min-w-0', hasCenteredAvatar ? 'w-full' : 'flex-1')}
              style={{
                paddingLeft: hasCenteredAvatar ? presentation.profileAvatarInsetPx : undefined,
                paddingRight: hasCenteredAvatar ? presentation.profileAvatarInsetPx : undefined,
                textAlign: presentation.profileTextAlign,
              }}
            >
              {profile.fullName ? (
                <h1
                  className="font-bold"
                  style={{
                    color: isClassic ? '#202027' : accent,
                    fontSize: formatting.nameFontSizePx,
                    letterSpacing: presentation.nameLetterSpacingPx,
                    lineHeight: presentation.nameLineHeight,
                  }}
                >
                  {profile.fullName}
                </h1>
              ) : null}
              {profile.targetRole ? (
                <p
                  style={{
                    color: presentation.bodyColor,
                    fontSize: formatting.bodyFontSizePx,
                    marginTop: presentation.roleMarginTopPx,
                  }}
                >
                  {formatTargetRole(profile.targetRole)}
                </p>
              ) : null}
              {contacts.length || printableLinks.length ? (
                <div
                  className={cn('flex flex-wrap', isClassic ? 'justify-center' : 'justify-start')}
                  style={{
                    color: presentation.bodyColor,
                    columnGap: presentation.contactsColumnGapPx,
                    fontSize: formatting.bodyFontSizePx,
                    marginTop: presentation.contactsMarginTopPx,
                    rowGap: presentation.contactsRowGapPx,
                  }}
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
                  'shrink-0 object-contain',
                  hasCenteredAvatar && 'absolute right-0 top-0',
                )}
                src={avatar}
                style={{
                  height: presentation.photoHeightPx,
                  marginLeft: hasCenteredAvatar ? undefined : presentation.photoGapPx,
                  width: presentation.photoWidthPx,
                }}
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
  const presentation = createResumePresentation(formatting, isClassic);
  return (
    <section className="break-inside-avoid" style={{ marginTop: formatting.sectionGapPx }}>
      <h2
        className={cn(
          'border-b font-bold tracking-[0.04em]',
          isClassic ? 'text-[#27242a]' : 'text-[var(--resume-accent)]',
        )}
        style={{
          borderColor: isClassic ? '#b9b4bc' : 'var(--resume-accent)',
          fontSize: formatting.sectionTitleFontSizePx,
          paddingBottom: presentation.sectionTitlePaddingBottomPx,
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
