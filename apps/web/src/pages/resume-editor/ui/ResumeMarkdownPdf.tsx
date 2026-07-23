import { Link, StyleSheet, Text, View } from '@react-pdf/renderer';

import {
  parseResumeMarkdown,
  type ResumeMarkdownBlock,
  type ResumeMarkdownInline,
} from '../model/resume.markdown';

type MarkdownPdfStyles = ReturnType<typeof createStyles>;

const styleCache = new Map<string, MarkdownPdfStyles>();

export function ResumeMarkdownPdf({ accent, value }: { accent: string; value: string }) {
  const styles = getStyles(accent);
  const document = parseResumeMarkdown(value);
  return (
    <View>
      {document.blocks.map((block, index) => (
        <PdfBlock block={block} key={index} styles={styles} />
      ))}
    </View>
  );
}

function PdfBlock({ block, styles }: { block: ResumeMarkdownBlock; styles: MarkdownPdfStyles }) {
  if (block.type === 'paragraph') {
    return (
      <Text style={styles.paragraph}>
        <PdfInline nodes={block.children} styles={styles} />
      </Text>
    );
  }
  return (
    <View style={styles.list}>
      {block.items.map((item, index) => (
        <View key={index} style={styles.listRow}>
          <Text style={styles.marker}>{block.ordered ? `${block.start + index}.` : '•'}</Text>
          <View style={styles.listContent}>
            {item.children.map((child, childIndex) => (
              <PdfBlock block={child} key={childIndex} styles={styles} />
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

function getStyles(accent: string): MarkdownPdfStyles {
  const cached = styleCache.get(accent);
  if (cached) return cached;
  const styles = createStyles(accent);
  styleCache.set(accent, styles);
  return styles;
}

function createStyles(accent: string) {
  return StyleSheet.create({
    paragraph: { marginTop: 3 },
    list: { marginTop: 3 },
    listRow: { flexDirection: 'row', marginTop: 1 },
    marker: { color: accent, width: 12 },
    listContent: { flex: 1 },
    strong: { fontWeight: 700 },
    emphasis: { fontStyle: 'italic' },
    inlineCode: { backgroundColor: '#f0edef', paddingHorizontal: 2 },
    link: { color: accent, textDecoration: 'underline' },
  });
}
