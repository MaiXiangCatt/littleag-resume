import remarkBreaks from 'remark-breaks';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

export type ResumeMarkdownInline =
  | { type: 'text'; value: string }
  | { type: 'break' }
  | { type: 'strong'; children: ResumeMarkdownInline[] }
  | { type: 'emphasis'; children: ResumeMarkdownInline[] }
  | { type: 'inlineCode'; value: string }
  | { type: 'link'; url: string; children: ResumeMarkdownInline[] };

export type ResumeMarkdownBlock =
  | { type: 'paragraph'; children: ResumeMarkdownInline[] }
  | {
      type: 'list';
      ordered: boolean;
      start: number;
      items: Array<{ children: ResumeMarkdownBlock[] }>;
    };

export type ResumeMarkdownDocument = {
  blocks: ResumeMarkdownBlock[];
};

type MdNode = {
  type: string;
  value?: string;
  url?: string;
  alt?: string;
  ordered?: boolean;
  start?: number | null;
  children?: MdNode[];
};

const markdownProcessor = unified().use(remarkParse).use(remarkBreaks);
const safeLinkPattern = /^(https?:|mailto:)/i;

export function parseResumeMarkdown(value: string): ResumeMarkdownDocument {
  const parsed = markdownProcessor.parse(value);
  const root = markdownProcessor.runSync(parsed) as MdNode;
  return { blocks: normalizeBlocks(root.children ?? []) };
}

function normalizeBlocks(nodes: MdNode[]): ResumeMarkdownBlock[] {
  return nodes.flatMap((node) => normalizeBlock(node));
}

function normalizeBlock(node: MdNode): ResumeMarkdownBlock[] {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return [paragraph(node.children ?? [])];
    case 'list':
      return [
        {
          type: 'list',
          ordered: Boolean(node.ordered),
          start: node.start ?? 1,
          items: (node.children ?? []).map((item) => ({
            children: normalizeBlocks(item.children ?? []),
          })),
        },
      ];
    case 'blockquote':
    case 'listItem':
      return normalizeBlocks(node.children ?? []);
    case 'code':
    case 'html':
      return node.value
        ? [{ type: 'paragraph', children: [{ type: 'text', value: node.value }] }]
        : [];
    default: {
      const children = normalizeInlineNodes(node.children ?? []);
      return children.length ? [{ type: 'paragraph', children }] : [];
    }
  }
}

function paragraph(nodes: MdNode[]): ResumeMarkdownBlock {
  return { type: 'paragraph', children: normalizeInlineNodes(nodes) };
}

function normalizeInlineNodes(nodes: MdNode[]): ResumeMarkdownInline[] {
  const normalized = nodes.flatMap((node) => normalizeInline(node));
  const merged: ResumeMarkdownInline[] = [];
  for (const node of normalized) {
    const previous = merged.at(-1);
    if (node.type === 'text' && previous?.type === 'text') {
      previous.value += node.value;
    } else {
      merged.push(node);
    }
  }
  return merged;
}

function normalizeInline(node: MdNode): ResumeMarkdownInline[] {
  switch (node.type) {
    case 'text':
      return node.value ? [{ type: 'text', value: node.value }] : [];
    case 'break':
      return [{ type: 'break' }];
    case 'strong':
    case 'emphasis':
      return [{ type: node.type, children: normalizeInlineNodes(node.children ?? []) }];
    case 'inlineCode':
      return [{ type: 'inlineCode', value: node.value ?? '' }];
    case 'link': {
      const children = normalizeInlineNodes(node.children ?? []);
      return node.url && safeLinkPattern.test(node.url.trim())
        ? [{ type: 'link', url: node.url.trim(), children }]
        : children;
    }
    case 'image':
      return node.alt ? [{ type: 'text', value: node.alt }] : [];
    case 'html':
      return node.value ? [{ type: 'text', value: node.value }] : [];
    default:
      return normalizeInlineNodes(node.children ?? []);
  }
}
