import { Link, StyleSheet, Text, View } from '@react-pdf/renderer';

import {
  parseResumeMarkdown,
  type ResumeMarkdownBlock,
  type ResumeMarkdownInline,
} from '../model/resume.markdown';

type MarkdownPdfStyles = ReturnType<typeof createStyles>;

const styleCache = new Map<string, MarkdownPdfStyles>();

export function ResumeMarkdownPdf({
  accent,
  bodyFontSizePx,
  value,
}: {
  accent: string;
  bodyFontSizePx: number;
  value: string;
}) {
  const styles = getStyles(accent, bodyFontSizePx);
  const document = parseResumeMarkdown(value);
  return (
    <View>
      {document.blocks.map((block, index) => (
        <PdfBlock block={block} first={index === 0} key={index} styles={styles} />
      ))}
    </View>
  );
}

function PdfBlock({
  block,
  first,
  styles,
}: {
  block: ResumeMarkdownBlock;
  first: boolean;
  styles: MarkdownPdfStyles;
}) {
  if (block.type === 'paragraph') {
    return (
      <Text style={first ? [styles.block, styles.firstBlock] : styles.block}>
        <PdfInline nodes={block.children} styles={styles} />
      </Text>
    );
  }
  return (
    <View style={first ? [styles.block, styles.firstBlock] : styles.block}>
      {block.items.map((item, index) => (
        <View key={index} style={styles.listRow}>
          <Text style={styles.marker}>{block.ordered ? `${block.start + index}.` : '•'}</Text>
          <View style={styles.listContent}>
            {item.children.map((child, childIndex) => (
              <PdfBlock block={child} first={childIndex === 0} key={childIndex} styles={styles} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function PdfInline({
  nodes,
  styles,
}: {
  nodes: ResumeMarkdownInline[];
  styles: MarkdownPdfStyles;
}) {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return node.value;
      case 'break':
        return '\n';
      case 'strong':
        return (
          <Text key={index} style={styles.strong}>
            <PdfInline nodes={node.children} styles={styles} />
          </Text>
        );
      case 'emphasis':
        return (
          <Text key={index} style={styles.emphasis}>
            <PdfInline nodes={node.children} styles={styles} />
          </Text>
        );
      case 'inlineCode':
        return (
          <Text key={index} style={styles.inlineCode}>
            {node.value}
          </Text>
        );
      case 'link':
        return (
          <Link key={index} src={node.url} style={styles.link}>
            <PdfInline nodes={node.children} styles={styles} />
          </Link>
        );
    }
  });
}

function getStyles(accent: string, bodyFontSizePx: number): MarkdownPdfStyles {
  const key = `${accent}:${bodyFontSizePx}`;
  const cached = styleCache.get(key);
  if (cached) return cached;
  const styles = createStyles(accent, bodyFontSizePx);
  styleCache.set(key, styles);
  return styles;
}

function createStyles(accent: string, bodyFontSizePx: number) {
  const base = bodyFontSizePx * 0.75;
  return StyleSheet.create({
    block: { marginTop: base * 0.45 },
    firstBlock: { marginTop: 0 },
    listRow: { flexDirection: 'row', marginTop: base * 0.2 },
    marker: { color: accent, width: base * 1.4 },
    listContent: { flex: 1 },
    strong: { fontWeight: 700 },
    emphasis: { fontStyle: 'italic' },
    inlineCode: { backgroundColor: '#f0edef', paddingHorizontal: 2 },
    link: { color: accent, textDecoration: 'underline' },
  });
}
