import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { MarkdownEditor } from './MarkdownEditor';

function EditorFixture() {
  const [value, setValue] = useState('Vega Resume');
  return (
    <MarkdownEditor ariaLabel="工作描述" onChange={setValue} placeholder="输入描述" value={value} />
  );
}

describe('MarkdownEditor', () => {
  it('wraps selected text with inline Markdown', async () => {
    const user = userEvent.setup();
    render(<EditorFixture />);
    const editor = screen.getByRole('textbox', { name: '工作描述' }) as HTMLTextAreaElement;

    editor.focus();
    editor.setSelectionRange(0, 4);
    await user.click(screen.getByRole('button', { name: '加粗' }));

    expect(editor).toHaveValue('**Vega** Resume');
  });

  it('prefixes selected lines as an ordered list', async () => {
    const user = userEvent.setup();
    render(<EditorFixture />);
    const editor = screen.getByRole('textbox', { name: '工作描述' }) as HTMLTextAreaElement;

    await user.clear(editor);
    await user.type(editor, '设计系统{enter}实时预览');
    editor.setSelectionRange(0, editor.value.length);
    await user.click(screen.getByRole('button', { name: '有序列表' }));

    expect(editor).toHaveValue('1. 设计系统\n2. 实时预览');
  });
});
