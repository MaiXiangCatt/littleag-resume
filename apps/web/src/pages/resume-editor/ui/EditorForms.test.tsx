import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SkillsSection } from '../model/resume.types';
import { SectionEditor } from './EditorForms';

describe('SectionEditor', () => {
  it('edits skills as one Markdown description', () => {
    const onChange = vi.fn();
    const section: SkillsSection = {
      id: 'skills',
      type: 'skills',
      title: '技能',
      enabled: true,
      description: '',
    };

    render(<SectionEditor onChange={onChange} section={section} />);

    const editor = screen.getByRole('textbox', { name: '技能内容' });
    fireEvent.change(editor, { target: { value: '**TypeScript**' } });

    expect(onChange).toHaveBeenLastCalledWith({
      ...section,
      description: '**TypeScript**',
    });
    expect(screen.queryByRole('button', { name: /新增一条技能/ })).not.toBeInTheDocument();
  });
});
