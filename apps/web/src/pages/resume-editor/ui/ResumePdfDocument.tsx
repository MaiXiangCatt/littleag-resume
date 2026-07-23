import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { RESUME_FONT_FAMILIES, resolveAccentColor } from '../model/resume.model';
import {
  getEntryDisplay,
  itemHasPrintableContent,
  sectionHasPrintableContent,
} from '../model/resume.preview';
import type { ResumeDocument, ResumeSection } from '../model/resume.types';
import { ResumeMarkdownPdf } from './ResumeMarkdownPdf';

Font.register({
  family: 'NotoSansSC',
  fonts: [
    { fontWeight: 400, src: '/fonts/NotoSansSC-Regular.ttf' },
    { fontWeight: 700, src: '/fonts/NotoSansSC-Regular.ttf' },
    { fontStyle: 'italic', fontWeight: 400, src: '/fonts/NotoSansSC-Regular.ttf' },
    { fontStyle: 'italic', fontWeight: 700, src: '/fonts/NotoSansSC-Regular.ttf' },
  ],
});

Font.register({
  family: 'NotoSerifSC',
  fonts: [
    { fontWeight: 400, src: '/fonts/NotoSerifSC-Variable.ttf' },
    { fontWeight: 700, src: '/fonts/NotoSerifSC-Variable.ttf' },
    { fontStyle: 'italic', fontWeight: 400, src: '/fonts/NotoSerifSC-Variable.ttf' },
    { fontStyle: 'italic', fontWeight: 700, src: '/fonts/NotoSerifSC-Variable.ttf' },
  ],
});

const pxToPt = (value: number) => value * 0.75;

export function ResumePdfDocument({
  avatar,
  resume,
}: {
  avatar: string | null;
  resume: ResumeDocument;
}) {
  const accent = resolveAccentColor(resume.content.formatting.accentColor);
  const isClassic = resume.templateId === 'classic-professional';
  const formatting = resume.content.formatting;
  const base = pxToPt(formatting.bodyFontSizePx);
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
      alignItems: avatar ? 'flex-start' : 'stretch',
      borderBottomColor: accent,
      borderBottomWidth: isClassic ? 0.7 : 2.2,
      flexDirection: avatar ? 'row' : 'column',
      justifyContent: avatar ? 'space-between' : 'flex-start',
      paddingBottom: 13,
    },
    identity: { ...(avatar ? { flexGrow: 1 } : {}), textAlign: isClassic ? 'center' : 'left' },
    name: {
      color: isClassic ? '#202027' : accent,
      fontSize: pxToPt(formatting.nameFontSizePx),
      fontWeight: 700,
      letterSpacing: isClassic ? 1.3 : -0.4,
      lineHeight: 1.15,
    },
    role: { color: '#242126', fontSize: base, lineHeight: 1.3, marginTop: 5 },
    contacts: {
      color: '#242126',
      flexDirection: 'row',
      flexWrap: 'wrap',
      fontSize: base,
      gap: 8,
      justifyContent: isClassic ? 'center' : 'flex-start',
      marginTop: 7,
    },
    avatar: {
      borderRadius: isClassic ? 35 : 6,
      height: 66,
      marginLeft: 18,
      objectFit: 'cover',
      width: 66,
    },
    section: { marginTop: pxToPt(formatting.sectionGapPx) },
    sectionTitle: {
      borderBottomColor: isClassic ? '#b9b4bc' : accent,
      borderBottomWidth: 0.65,
      color: isClassic ? '#27242a' : accent,
      fontSize: pxToPt(formatting.sectionTitleFontSizePx),
      fontWeight: 700,
      letterSpacing: 0.5,
      paddingBottom: 3,
      textTransform: 'uppercase',
    },
    entry: { marginTop: 7 },
    entryHead: { flexDirection: 'row', justifyContent: 'space-between' },
    entryTitle: { fontSize: pxToPt(formatting.entryTitleFontSizePx), fontWeight: 700 },
    entryDate: { fontSize: pxToPt(formatting.entryTitleFontSizePx) },
    link: { color: '#242126', textDecoration: 'none' },
  });

  const profile = resume.content.profile;
  const contacts = [profile.phone, profile.email, profile.location].filter(Boolean);

  return (
    <Document
      author={profile.fullName || 'VegaResume'}
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
            <View style={styles.identity}>
              {profile.fullName ? <Text style={styles.name}>{profile.fullName}</Text> : null}
              {profile.targetRole ? <Text style={styles.role}>{profile.targetRole}</Text> : null}
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
            </View>
            {avatar ? <Image src={avatar} style={styles.avatar} /> : null}
          </View>
        ) : null}
        {resume.content.sections.filter(sectionHasPrintableContent).map((section) => (
          <PdfSection accent={accent} key={section.id} section={section} styles={styles} />
        ))}
      </Page>
    </Document>
  );
}

function PdfSection({
  accent,
  section,
  styles,
}: {
  accent: string;
  section: ResumeSection;
  styles: ReturnType<typeof StyleSheet.create>;
}) {
  if (!sectionHasPrintableContent(section)) return null;
  if (section.type === 'summary' || section.type === 'skills') {
    const markdown = section.type === 'summary' ? section.text : section.description;
    return (
      <View style={styles.section} minPresenceAhead={40}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={{ marginTop: 7 }}>
          <ResumeMarkdownPdf accent={accent} value={markdown} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.section} minPresenceAhead={55}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.items.filter(itemHasPrintableContent).map((item) => {
        const display = getEntryDisplay(section.type, item as Record<string, unknown>);
        return (
          <View key={item.id} style={styles.entry}>
            <View style={styles.entryHead}>
              <Text style={styles.entryTitle}>{display.title}</Text>
              <Text style={styles.entryDate}>{display.date}</Text>
            </View>
            {display.description.trim() ? (
              <ResumeMarkdownPdf accent={accent} value={display.description} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
