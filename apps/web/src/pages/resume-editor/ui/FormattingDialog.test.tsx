import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createDefaultContent } from '../model/resume.model';
import type { ResumeDocument } from '../model/resume.types';
import { FormattingDialog } from './ResumeEditorPage';

function createResume(): ResumeDocument {
  return {
    id: 'resume-1',
    title: '测试简历',
    status: 'draft',
    revision: 1,
    hasAvatar: false,
    templateId: 'modern-editorial',
    exportCount: 0,
    contentVersion: 2,
    content: createDefaultContent(),
    createdAt: '2026-07-23T00:00:00Z',
    updatedAt: '2026-07-23T00:00:00Z',
  };
}

function FormattingFixture() {
  const [resume, setResume] = useState(createResume);
  return (
    <FormattingDialog
      document={resume}
      onChange={(formatting) =>
        setResume((current) => ({
          ...current,
          content: { ...current.content, formatting },
        }))
      }
      onClose={vi.fn()}
      onTemplate={(templateId) => setResume((current) => ({ ...current, templateId }))}
    />
  );
}

describe('FormattingDialog', () => {
  it('updates independent numeric fields and restores defaults', async () => {
    const user = userEvent.setup();
    render(<FormattingFixture />);
    const nameSize = screen.getByRole('spinbutton', { name: '姓名' });
    const leftMargin = screen.getByRole('spinbutton', { name: '左' });

    await user.clear(nameSize);
    await user.type(nameSize, '24');
    await user.tab();
    await user.clear(leftMargin);
    await user.type(leftMargin, '42');
    await user.tab();

    expect(nameSize).toHaveValue(24);
    expect(leftMargin).toHaveValue(42);

    await user.clear(nameSize);
    await user.tab();
    expect(nameSize).toHaveValue(24);

    await user.click(screen.getByRole('button', { name: '恢复默认' }));
    expect(screen.getByRole('spinbutton', { name: '姓名' })).toHaveValue(20);
    expect(screen.getByRole('spinbutton', { name: '左' })).toHaveValue(33);
  });
});
