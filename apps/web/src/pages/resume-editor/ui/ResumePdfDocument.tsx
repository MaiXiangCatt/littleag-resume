import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { RESUME_FONT_FAMILIES, resolveAccentColor } from '../model/resume.model';
import {
  getEntryDisplay,
  itemHasPrintableContent,
  sectionHasPrintableContent,
} from '../model/resume.preview';
import { createResumePresentation, formatTargetRole, pxToPt } from '../model/resume.presentation';
import type { ResumeDocument, ResumeFormatting, ResumeSection } from '../model/resume.types';
import { ResumeMarkdownPdf } from './ResumeMarkdownPdf';

Font.register({
  family: 'NotoSansSC',
  fonts: [
    { fontWeight: 400, src: '/fonts/NotoSansSC-Pdf-Regular.ttf' },
    { fontWeight: 700, src: '/fonts/NotoSansSC-Pdf-Bold.ttf' },
    { fontStyle: 'italic', fontWeight: 400, src: '/fonts/NotoSansSC-Pdf-Regular.ttf' },
    { fontStyle: 'italic', fontWeight: 700, src: '/fonts/NotoSansSC-Pdf-Bold.ttf' },
  ],
});
Font.register({
  family: 'NotoSerifSC',
  fonts: [
    { fontWeight: 400, src: '/fonts/NotoSerifSC-Pdf-Regular.ttf' },
    { fontWeight: 700, src: '/fonts/NotoSerifSC-Pdf-Bold.ttf' },
    { fontStyle: 'italic', fontWeight: 400, src: '/fonts/NotoSerifSC-Pdf-Regular.ttf' },
    { fontStyle: 'italic', fontWeight: 700, src: '/fonts/NotoSerifSC-Pdf-Bold.ttf' },
  ],
});

export function ResumePdfDocument({
  avatar,
  resume,
}: {
  avatar: string | null;
  resume: ResumeDocument;
}) {
  const accent = resolveAccentColor(resume.content.formatting.accentColor);
  const profileAlignment = resume.profileAlignment;
  const formatting = resume.content.formatting;
  const base = pxToPt(formatting.bodyFontSizePx);
  const presentation = createResumePresentation(formatting, profileAlignment);
  const hasCenteredAvatar = profileAlignment === 'center' && Boolean(avatar);
  const hasSideAvatar = Boolean(avatar) && !hasCenteredAvatar;
  const avatarOnLeft = profileAlignment === 'right' && hasSideAvatar;
  const avatarLayout = createAvatarLayout(
    hasCenteredAvatar,
    avatarOnLeft,
    pxToPt(presentation.photoGapPx),
  );
  const styles = StyleSheet.create({
    page: {
      backgroundColor: '#ffffff',
      color: '#242126',
      fontFamily: RESUME_FONT_FAMILIES[formatting.fontFamily].pdfFamily,
      fontSize: base,
      lineHeight: formatting.lineHeightRatio,
      paddingBottom: pxToPt(formatting.pageMarginPx.bottom),
      paddingLeft: pxToPt(formatting.pageMarginPx.left),
      paddingRight: pxToPt(formatting.pageMarginPx.right),
      paddingTop: pxToPt(formatting.pageMarginPx.top),
    },
    header: {
      alignItems: hasSideAvatar ? 'flex-start' : 'stretch',
      flexDirection: hasSideAvatar ? 'row' : 'column',
      justifyContent: hasSideAvatar ? 'space-between' : 'flex-start',
      minHeight: hasCenteredAvatar
        ? pxToPt(presentation.photoHeightPx + presentation.headerPaddingBottomPx)
        : undefined,
      paddingBottom: pxToPt(presentation.headerPaddingBottomPx),
      position: hasCenteredAvatar ? 'relative' : 'static',
    },
    identity: {
      ...(hasCenteredAvatar
        ? {
            paddingLeft: pxToPt(presentation.profileAvatarInsetPx),
            paddingRight: pxToPt(presentation.profileAvatarInsetPx),
            width: '100%',
          }
        : {}),
      ...(hasSideAvatar ? { flexBasis: 0, flexGrow: 1 } : {}),
    },
    name: {
      color: presentation.bodyColor,
      fontSize: pxToPt(formatting.nameFontSizePx),
      fontWeight: 700,
      letterSpacing: pxToPt(presentation.nameLetterSpacingPx),
      lineHeight: presentation.nameLineHeight,
      textAlign: presentation.profileTextAlign,
    },
    role: {
      color: presentation.bodyColor,
      fontSize: base,
      marginTop: pxToPt(presentation.roleMarginTopPx),
      textAlign: presentation.profileTextAlign,
    },
    contacts: {
      color: presentation.bodyColor,
      flexDirection: 'row',
      flexWrap: 'wrap',
      fontSize: base,
      columnGap: pxToPt(presentation.contactsColumnGapPx),
      justifyContent: justifyContentForAlignment(profileAlignment),
      marginTop: pxToPt(presentation.contactsMarginTopPx),
      rowGap: pxToPt(presentation.contactsRowGapPx),
    },
    avatar: {
      height: pxToPt(presentation.photoHeightPx),
      objectFit: 'contain',
      ...avatarLayout,
      width: pxToPt(presentation.photoWidthPx),
    },
    section: {},
    sectionTitle: {
      borderBottomColor: accent,
      borderBottomWidth: 0.65,
      color: accent,
      fontSize: pxToPt(formatting.sectionTitleFontSizePx),
      fontWeight: 700,
      letterSpacing: 0.5,
      paddingBottom: pxToPt(presentation.sectionTitlePaddingBottomPx),
    },
    sectionContent: { marginTop: pxToPt(presentation.sectionContentMarginTopPx) },
    entries: { marginTop: pxToPt(presentation.sectionContentMarginTopPx) },
    entry: {},
    entryHead: { flexDirection: 'row', justifyContent: 'space-between' },
    entryTitle: { fontSize: pxToPt(formatting.entryTitleFontSizePx), fontWeight: 700 },
    entryDate: { fontSize: pxToPt(formatting.entryTitleFontSizePx) },
    entryDescription: { marginTop: pxToPt(presentation.entryDescriptionMarginTopPx) },
    link: { color: presentation.bodyColor, textDecoration: 'none' },
  });

  const profile = resume.content.profile;
  const contacts = [profile.phone, profile.email, profile.location].filter(Boolean);

  return (
    <Document
      author={profile.fullName || 'LittleAgResume'}
      subject={profile.targetRole}
      title={resume.title}
    >
      <Page size="A4" style={styles.page} wrap>
        {profile.fullName ||
        profile.targetRole ||
        contacts.length ||
        profile.links.length ||
        avatar ? (
          <View style={styles.header}>
            {avatar && avatarOnLeft ? <Image src={avatar} style={styles.avatar} /> : null}
            <View style={styles.identity}>
              {profile.fullName ? <Text style={styles.name}>{profile.fullName}</Text> : null}
              {profile.targetRole ? (
                <Text style={styles.role}>{formatTargetRole(profile.targetRole)}</Text>
              ) : null}
              {contacts.length || profile.links.some((item) => item.label && item.url) ? (
                <View style={styles.contacts}>
                  {contacts.map((value) => (
                    <Text key={value}>{value}</Text>
                  ))}
                  {profile.links
                    .filter((item) => item.label && item.url)
                    .map((item) => (
                      <Link key={item.id} src={item.url} style={styles.link}>
                        {item.label}
                      </Link>
                    ))}
                </View>
              ) : null}
            </View>
            {avatar && !avatarOnLeft ? <Image src={avatar} style={styles.avatar} /> : null}
          </View>
        ) : null}
        {resume.content.sections.filter(sectionHasPrintableContent).map((section) => (
          <PdfSection
            accent={accent}
            formatting={formatting}
            key={section.id}
            section={section}
            styles={styles}
          />
        ))}
      </Page>
    </Document>
  );
}

function justifyContentForAlignment(
  alignment: ResumeDocument['profileAlignment'],
): 'center' | 'flex-end' | 'flex-start' {
  switch (alignment) {
    case 'center':
      return 'center';
    case 'right':
      return 'flex-end';
    default:
      return 'flex-start';
  }
}

function createAvatarLayout(hasCenteredAvatar: boolean, avatarOnLeft: boolean, gap: number) {
  if (hasCenteredAvatar) {
    return { position: 'absolute' as const, right: 0, top: 0 };
  }
  if (avatarOnLeft) return { marginRight: gap };
  return { marginLeft: gap };
}

function PdfSection({
  accent,
  formatting,
  section,
  styles,
}: {
  accent: string;
  formatting: ResumeFormatting;
  section: ResumeSection;
  styles: ReturnType<typeof StyleSheet.create>;
}) {
  if (!sectionHasPrintableContent(section)) return null;
  if (section.type === 'summary' || section.type === 'skills') {
    const markdown = section.type === 'summary' ? section.text : section.description;
    return (
      <View
        style={[
          styles.section,
          { marginTop: pxToPt(section.spacingBeforePx ?? formatting.sectionGapPx) },
        ]}
        minPresenceAhead={40}
      >
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.sectionContent}>
          <ResumeMarkdownPdf
            accent={accent}
            bodyFontSizePx={formatting.bodyFontSizePx}
            value={markdown}
          />
        </View>
      </View>
    );
  }
  return (
    <View
      style={[
        styles.section,
        { marginTop: pxToPt(section.spacingBeforePx ?? formatting.sectionGapPx) },
      ]}
      minPresenceAhead={55}
    >
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.entries}>
        {section.items.filter(itemHasPrintableContent).map((item, index) => {
          const display = getEntryDisplay(section.type, item as Record<string, unknown>);
          return (
            <View
              key={item.id}
              style={
                index > 0
                  ? [
                      styles.entry,
                      {
                        marginTop: pxToPt(item.spacingBeforePx ?? formatting.entryGapPx),
                      },
                    ]
                  : styles.entry
              }
            >
              <View style={styles.entryHead}>
                <Text style={styles.entryTitle}>{display.title}</Text>
                <Text style={styles.entryDate}>{display.date}</Text>
              </View>
              {display.description.trim() ? (
                <View style={styles.entryDescription}>
                  <ResumeMarkdownPdf
                    accent={accent}
                    bodyFontSizePx={formatting.bodyFontSizePx}
                    value={display.description}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
