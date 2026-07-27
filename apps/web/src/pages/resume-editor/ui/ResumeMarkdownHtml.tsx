import { Fragment, useMemo } from 'react';

import { Link } from '@/shared/ui/link';
import { cn } from '@/shared/lib/utils';

import {
  parseResumeMarkdown,
  type ResumeMarkdownBlock,
  type ResumeMarkdownInline,
} from '../model/resume.markdown';

export function ResumeMarkdownHtml({ className, value }: { className?: string; value: string }) {
  const document = useMemo(() => parseResumeMarkdown(value), [value]);
  return (
    <div className={cn('resume-markdown', className)}>
      {document.blocks.map((block, index) => (
        <HtmlBlock block={block} key={index} />
      ))}
    </div>
  );
}

function HtmlBlock({ block }: { block: ResumeMarkdownBlock }) {
  if (block.type === 'paragraph') {
    return (
      <p className="mt-[0.45em] first:mt-0">
        <HtmlInline nodes={block.children} />
      </p>
    );
  }
  const List = block.ordered ? 'ol' : 'ul';
  return (
    <List
      className={cn(
        'mt-[0.45em] space-y-[0.2em] pl-[1.4em] first:mt-0 marker:font-semibold marker:text-[var(--resume-accent)]',
        block.ordered ? 'list-decimal' : 'list-disc',
      )}
      start={block.ordered ? block.start : undefined}
    >
      {block.items.map((item, index) => (
        <li className="pl-[0.2em]" key={index}>
          {item.children.map((child, childIndex) => (
            <HtmlBlock block={child} key={childIndex} />
          ))}
        </li>
      ))}
    </List>
  );
}

function HtmlInline({ nodes }: { nodes: ResumeMarkdownInline[] }) {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return <Fragment key={index}>{node.value}</Fragment>;
      case 'break':
        return <br key={index} />;
      case 'strong':
        return (
          <strong className="font-bold" key={index}>
            <HtmlInline nodes={node.children} />
          </strong>
        );
      case 'emphasis':
        return (
          <em key={index}>
            <HtmlInline nodes={node.children} />
          </em>
        );
      case 'inlineCode':
        return (
          <code
            className="rounded-[0.25em] bg-black/[0.055] px-[0.28em] py-[0.08em] font-mono text-[0.92em]"
            key={index}
          >
            {node.value}
          </code>
        );
      case 'link':
        return (
          <Link
            className="font-medium text-[var(--resume-accent)] underline decoration-current/35 underline-offset-[0.16em]"
            href={node.url}
            key={index}
            rel="noreferrer"
            target="_blank"
          >
            <HtmlInline nodes={node.children} />
          </Link>
        );
    }
  });
}
