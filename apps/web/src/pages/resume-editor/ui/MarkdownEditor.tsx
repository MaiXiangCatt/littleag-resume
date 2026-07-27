import { Bold, Code2, Italic, Link2, List, ListOrdered } from 'lucide-react';
import { useRef } from 'react';

import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';
import { cn } from '@/shared/lib/utils';

type MarkdownEditorProps = {
  ariaLabel: string;
  className?: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
};

const toolbarActions = [
  { icon: Bold, label: '加粗', action: 'bold' },
  { icon: Italic, label: '斜体', action: 'italic' },
  { icon: List, label: '无序列表', action: 'unordered-list' },
  { icon: ListOrdered, label: '有序列表', action: 'ordered-list' },
  { icon: Link2, label: '插入链接', action: 'link' },
  { icon: Code2, label: '行内代码', action: 'code' },
] as const;

export function MarkdownEditor({
  ariaLabel,
  className,
  onChange,
  placeholder,
  value,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function replaceSelection(replacement: string, selectionStart: number, selectionEnd: number) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    onChange(
      `${value.slice(0, textarea.selectionStart)}${replacement}${value.slice(textarea.selectionEnd)}`,
    );
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function wrapSelection(prefix: string, suffix: string, fallback: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selected = value.slice(textarea.selectionStart, textarea.selectionEnd) || fallback;
    const replacement = `${prefix}${selected}${suffix}`;
    const start = textarea.selectionStart + prefix.length;
    replaceSelection(replacement, start, start + selected.length);
  }

  function prefixSelectedLines(ordered: boolean) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const lineStart = value.lastIndexOf('\n', Math.max(0, textarea.selectionStart - 1)) + 1;
    const nextBreak = value.indexOf('\n', textarea.selectionEnd);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const selectedLines = value.slice(lineStart, lineEnd).split('\n');
    const replacement = selectedLines
      .map((line, index) => `${ordered ? `${index + 1}.` : '-'} ${line}`)
      .join('\n');
    replaceSelection(replacement, lineStart, lineStart + replacement.length);
  }

  function applyAction(action: (typeof toolbarActions)[number]['action']) {
    switch (action) {
      case 'bold':
        wrapSelection('**', '**', '重点内容');
        break;
      case 'italic':
        wrapSelection('*', '*', '强调内容');
        break;
      case 'unordered-list':
        prefixSelectedLines(false);
        break;
      case 'ordered-list':
        prefixSelectedLines(true);
        break;
      case 'link':
        wrapSelection('[', '](https://)', '链接文字');
        break;
      case 'code':
        wrapSelection('`', '`', '代码');
        break;
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-input bg-background shadow-xs transition focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      <div
        aria-label={`${ariaLabel} Markdown 工具栏`}
        className="flex items-center gap-0.5 border-b border-[#eee7eb] bg-[#faf8f9] px-2 py-1.5"
        role="toolbar"
      >
        {toolbarActions.map(({ action, icon: Icon, label }) => (
          <Button
            aria-label={label}
            className="size-8 rounded-lg text-[#685c65] hover:bg-white hover:text-[#087EA4]"
            key={action}
            onClick={() => applyAction(action)}
            size="icon"
            title={label}
            variant="ghost"
          >
            <Icon size={15} />
          </Button>
        ))}
        <span className="ml-auto pr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a0939c]">
          Markdown
        </span>
      </div>
      <Textarea
        aria-label={ariaLabel}
        className={cn(
          'min-h-32 resize-y rounded-none border-0 shadow-none focus-visible:ring-0',
          className,
        )}
        placeholder={placeholder}
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="border-t border-[#f0eaee] bg-white px-3 py-2 text-[11px] text-[#92858e]">
        支持列表、粗体、斜体、行内代码和安全链接；按 Enter 会直接换行。
      </p>
    </div>
  );
}
