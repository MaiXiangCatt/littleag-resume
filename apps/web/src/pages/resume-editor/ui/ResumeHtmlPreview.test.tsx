import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createDefaultContent } from '../model/resume.model';
import type { ResumeDocument } from '../model/resume.types';
import { ResumeHtmlPreview } from './ResumeHtmlPreview';

function createResume(): ResumeDocument {
  const content = createDefaultContent();
  content.profile = {
    fullName: '林清清',
    targetRole: '前端开发工程师',
    phone: '',
    email: 'qingqing@example.com',
    location: '',
    links: [{ id: 'portfolio', label: '作品集', url: 'https://example.com' }],
  };
  const summary = content.sections.find((section) => section.type === 'summary');
  if (summary?.type === 'summary') summary.text = '专注于**复杂编辑体验**。';
  const work = content.sections.find((section) => section.type === 'work');
  if (work?.type === 'work') {
    work.items.push({
      id: 'work-1',
      company: 'Vega Resume',
      role: '前端工程师',
      location: '上海',
      startDate: '2025-01',
      endDate: '',
      isCurrent: true,
      description: '- 构建**实时简历预览**\n- 消除 PDF iframe 闪烁',
    });
  }
  return {
    id: 'resume-1',
    title: '测试简历',
    status: 'draft',
    revision: 1,
    hasAvatar: false,
    templateId: 'modern-editorial',
    exportCount: 0,
    contentVersion: 2,
    content,
    createdAt: '2026-07-22T00:00:00Z',
    updatedAt: '2026-07-22T00:00:00Z',
  };
}

describe('ResumeHtmlPreview', () => {
  it('renders schema content and omits empty sections and fields', () => {
    const resume = createResume();
    render(<ResumeHtmlPreview avatar={null} resume={resume} />);

    expect(screen.getByLabelText('测试简历 A4 实时预览')).toHaveAttribute(
      'data-template',
      'modern-editorial',
    );
    expect(screen.getByRole('heading', { name: '林清清' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '林清清' })).toHaveStyle({ fontSize: '20px' });
    expect(screen.getByRole('heading', { name: '工作经历' })).toHaveStyle({
      fontSize: '16px',
    });
    const workHeading = screen.getByRole('heading', {
      name: /Vega Resume\s+前端工程师\s+上海/,
    });
    expect(workHeading).toHaveStyle({
      fontSize: '14px',
    });
    expect(screen.getByText('复杂编辑体验').tagName).toBe('STRONG');
    expect(screen.getByText('前端开发工程师')).toBeVisible();
    expect(screen.getByRole('link', { name: '作品集' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(workHeading).toBeVisible();
    expect(screen.getByText('2025-01 – 至今')).toHaveStyle({ fontSize: '14px' });
    expect(screen.getByText('消除 PDF iframe 闪烁')).toBeVisible();
    expect(screen.queryByText('教育背景')).not.toBeInTheDocument();
    expect(screen.queryByText('奖项荣誉')).not.toBeInTheDocument();
    expect(screen.getByLabelText('测试简历 A4 实时预览').querySelector('article')).toHaveStyle({
      paddingTop: '33px',
      paddingRight: '33px',
      paddingBottom: '33px',
      paddingLeft: '33px',
    });
    expect(screen.getByLabelText('测试简历 A4 实时预览')).toHaveStyle({
      fontFamily: "'Noto Sans SC', 'PingFang SC', sans-serif",
    });
  });

  it('switches template presentation without changing content', () => {
    const resume = createResume();
    const { rerender } = render(<ResumeHtmlPreview avatar={null} resume={resume} />);

    rerender(
      <ResumeHtmlPreview
        avatar={null}
        resume={{ ...resume, templateId: 'classic-professional' }}
      />,
    );

    expect(screen.getByLabelText('测试简历 A4 实时预览')).toHaveAttribute(
      'data-template',
      'classic-professional',
    );
    expect(screen.getByRole('heading', { name: '林清清' })).toBeVisible();
  });
});
