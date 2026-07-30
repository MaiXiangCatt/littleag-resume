import { ArrowLeft, FileText, Scale } from 'lucide-react';
import Markdown, { type Components } from 'react-markdown';

import { legalDocuments } from '@/pages/legal/model/legal-document';
import type { LegalDocumentKey } from '@/pages/legal/model/legal-routes';
import { Button } from '@/shared/ui/button';
import { Link } from '@/shared/ui/link';

type LegalDocumentPageProps = {
  documentKey: LegalDocumentKey;
};

const markdownComponents: Components = {
  a(markdownProps) {
    const { children, href, ...props } = withoutMarkdownNode(markdownProps);
    const external = href?.startsWith('http');
    return (
      <Link
        className="font-medium text-primary underline decoration-primary/30 transition-colors hover:decoration-primary"
        href={href}
        rel={external ? 'noreferrer' : undefined}
        target={external ? '_blank' : undefined}
        {...props}
      >
        {children}
      </Link>
    );
  },
  blockquote(markdownProps) {
    const { children, ...props } = withoutMarkdownNode(markdownProps);
    return (
      <blockquote
        className="my-6 rounded-r-xl border-l-4 border-primary/55 bg-primary/5 px-5 py-4 text-foreground/85"
        {...props}
      >
        {children}
      </blockquote>
    );
  },
  code(markdownProps) {
    const { children, className, ...props } = withoutMarkdownNode(markdownProps);
    return (
      <code
        className={`rounded bg-muted px-1.5 py-0.5 text-[0.9em] text-foreground ${className ?? ''}`}
        {...props}
      >
        {children}
      </code>
    );
  },
  h1(markdownProps) {
    const { children, ...props } = withoutMarkdownNode(markdownProps);
    return (
      <h1
        className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        {...props}
      >
        {children}
      </h1>
    );
  },
  h2(markdownProps) {
    const { children, ...props } = withoutMarkdownNode(markdownProps);
    return (
      <h2
        className="mt-12 border-b border-border pb-3 font-serif text-2xl font-semibold tracking-tight text-foreground first:mt-0"
        {...props}
      >
        {children}
      </h2>
    );
  },
  h3(markdownProps) {
    const { children, ...props } = withoutMarkdownNode(markdownProps);
    return (
      <h3 className="mt-8 text-lg font-semibold text-foreground" {...props}>
        {children}
      </h3>
    );
  },
  li(markdownProps) {
    const { children, ...props } = withoutMarkdownNode(markdownProps);
    return (
      <li className="pl-1 marker:text-primary/75" {...props}>
        {children}
      </li>
    );
  },
  ol(markdownProps) {
    const { children, ...props } = withoutMarkdownNode(markdownProps);
    return (
      <ol className="my-4 space-y-2.5 pl-6 [list-style:decimal]" {...props}>
        {children}
      </ol>
    );
  },
  p(markdownProps) {
    const { children, ...props } = withoutMarkdownNode(markdownProps);
    return (
      <p className="my-4 leading-8 text-foreground/80" {...props}>
        {children}
      </p>
    );
  },
  strong(markdownProps) {
    const { children, ...props } = withoutMarkdownNode(markdownProps);
    return (
      <strong className="font-semibold text-foreground" {...props}>
        {children}
      </strong>
    );
  },
  ul(markdownProps) {
    const { children, ...props } = withoutMarkdownNode(markdownProps);
    return (
      <ul className="my-4 space-y-2.5 pl-6 [list-style:disc]" {...props}>
        {children}
      </ul>
    );
  },
};

function withoutMarkdownNode<T extends { node?: unknown }>(markdownProps: T): Omit<T, 'node'> {
  const elementProps = { ...markdownProps };
  delete elementProps.node;
  return elementProps;
}

export function LegalDocumentPage({ documentKey }: LegalDocumentPageProps) {
  const document = legalDocuments[documentKey];

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-6 sm:px-6 sm:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-primary/7 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -left-32 size-[30rem] rounded-full bg-[#efd7cf]/50 blur-3xl"
      />

      <div className="relative mx-auto max-w-4xl">
        <header className="mb-5 flex items-center justify-between gap-4">
          <Button asChild className="-ml-3 gap-2" variant="ghost">
            <Link href="/">
              <ArrowLeft aria-hidden="true" className="size-4" />
              返回 LittleAgResume
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
            <Scale aria-hidden="true" className="size-4 text-primary" />
            法律文本
          </div>
        </header>

        <section className="mb-4 rounded-2xl border border-primary/15 bg-primary/[0.035] px-5 py-4 shadow-sm sm:px-7">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
              <FileText aria-hidden="true" className="size-4" />
            </div>
            <div>
              <p className="m-0 text-sm font-semibold text-foreground">{document.title}</p>
              <p className="mb-0 mt-1 text-sm leading-6 text-muted-foreground">
                {document.description}
              </p>
            </div>
          </div>
        </section>

        <article className="rounded-3xl border bg-card px-6 py-8 shadow-[0_24px_80px_rgba(85,46,40,0.08)] sm:px-10 sm:py-12">
          <Markdown components={markdownComponents}>{document.content}</Markdown>
        </article>

        <footer className="px-3 py-8 text-center text-xs leading-6 text-muted-foreground">
          对文本或个人信息处理有疑问，请联系{' '}
          <Link
            className="font-medium text-foreground hover:text-primary"
            href="mailto:littleag_resume@163.com"
          >
            littleag_resume@163.com
          </Link>
        </footer>
      </div>
    </main>
  );
}
