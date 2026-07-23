import { describe, expect, it } from 'vitest';

import { parseResumeMarkdown } from './resume.markdown';

describe('resume Markdown', () => {
  it('supports resume-safe inline formatting and visible single line breaks', () => {
    const document = parseResumeMarkdown(
      '第一行\n第二行 **加粗** *斜体* `代码` [官网](https://example.com)',
    );

    expect(document.blocks).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: '第一行' },
          { type: 'break' },
          { type: 'text', value: '第二行 ' },
          { type: 'strong', children: [{ type: 'text', value: '加粗' }] },
          { type: 'text', value: ' ' },
          { type: 'emphasis', children: [{ type: 'text', value: '斜体' }] },
          { type: 'text', value: ' ' },
          { type: 'inlineCode', value: '代码' },
          { type: 'text', value: ' ' },
          {
            type: 'link',
            url: 'https://example.com',
            children: [{ type: 'text', value: '官网' }],
          },
        ],
      },
    ]);
  });

  it('keeps ordered and unordered list semantics', () => {
    const document = parseResumeMarkdown('- 第一项\n- 第二项\n\n1. 计划\n2. 交付');

    expect(document.blocks).toMatchObject([
      { type: 'list', ordered: false, start: 1, items: [{}, {}] },
      { type: 'list', ordered: true, start: 1, items: [{}, {}] },
    ]);
  });

  it('does not activate unsafe links, HTML, headings, images or code blocks', () => {
    const document = parseResumeMarkdown(
      '# 标题\n\n[危险](javascript:alert(1))\n\n<b>HTML</b>\n\n![头像](https://example.com/a.png)\n\n```js\nalert(1)\n```',
    );

    expect(document.blocks).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: '标题' }] },
      { type: 'paragraph', children: [{ type: 'text', value: '危险' }] },
      { type: 'paragraph', children: [{ type: 'text', value: '<b>HTML</b>' }] },
      { type: 'paragraph', children: [{ type: 'text', value: '头像' }] },
      { type: 'paragraph', children: [{ type: 'text', value: 'alert(1)' }] },
    ]);
  });
});
