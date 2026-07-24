import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createDefaultContent } from '../model/resume.model';
import { RESUME_PHOTO_SPEC } from '../model/resume.presentation';
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
  const education = content.sections.find((section) => section.type === 'education');
  if (education?.type === 'education') {
    education.items.push({
      id: 'education-1',
      school: '国立中央大学',
      major: '如何退休',
      degree: '硕士',
      startDate: '2026-01',
      endDate: '2026-07',
      description: '获得超级奖学金。',
    });
  }
  const project = content.sections.find((section) => section.type === 'project');
  if (project?.type === 'project') {
    project.items.push({
      id: 'project-1',
      name: '中药奶茶',
      role: '主理人',
      startDate: '2026-01',
      endDate: '2026-02',
      isCurrent: false,
      description: '来原地转一圈。',
    });
  }
  const skills = content.sections.find((section) => section.type === 'skills');
  if (skills?.type === 'skills') {
    skills.description = '- **TypeScript**：熟练\n- React：熟悉组件设计';
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
    expect(screen.getByText('求职意向：前端开发工程师')).toHaveStyle({
      color: '#242126',
      fontSize: '14px',
    });
    expect(screen.getByText('qingqing@example.com').parentElement).toHaveStyle({
      color: '#242126',
      fontSize: '14px',
    });
    expect(screen.getByRole('link', { name: '作品集' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(workHeading).toBeVisible();
    expect(screen.getByText('2025-01 – 至今')).toHaveStyle({ fontSize: '14px' });
    expect(screen.getByText('消除 PDF iframe 闪烁')).toBeVisible();
    expect(
      screen.getByRole('heading', {
        name: /国立中央大学\s+如何退休\s+硕士/,
      }),
    ).toHaveStyle({ fontSize: '14px' });
    expect(
      screen.getByRole('heading', {
        name: /中药奶茶\s+主理人/,
      }),
    ).toHaveStyle({ fontSize: '14px' });
    expect(screen.getByText('TypeScript').tagName).toBe('STRONG');
    expect(screen.getByText('React：熟悉组件设计')).toBeVisible();
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

  it('uses a rectangular one-inch photo without a header divider', () => {
    const resume = { ...createResume(), templateId: 'classic-professional' as const };
    const { container } = render(
      <ResumeHtmlPreview
        avatar="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q=="
        resume={resume}
      />,
    );

    const photo = container.querySelector('header img');
    const header = container.querySelector('header');

    expect(photo).toBeInTheDocument();
    expect(
      Number.parseFloat((photo as HTMLImageElement).style.width) /
        Number.parseFloat((photo as HTMLImageElement).style.height),
    ).toBeCloseTo(RESUME_PHOTO_SPEC.aspectRatio);
    expect(photo).toHaveClass('object-contain');
    expect(photo).not.toHaveClass('rounded-full');
    expect(header).not.toHaveClass('border-b');
    expect(screen.getByText('求职意向：前端开发工程师').parentElement).toHaveStyle({
      textAlign: 'center',
    });
  });

  it('uses the printable page content width instead of overflowing the A4 margins', () => {
    render(<ResumeHtmlPreview avatar={null} mode="print" resume={createResume()} />);

    const preview = screen.getByLabelText('测试简历 A4 实时预览');
    expect(preview).toHaveClass('w-full', 'max-w-none');
    expect(preview).not.toHaveClass('w-[210mm]');
  });
});
