import { Children, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { createDefaultContent } from '../model/resume.model';
import { createResumePresentation, pxToPt } from '../model/resume.presentation';
import type { ResumeDocument } from '../model/resume.types';
import { ResumePdfDocument } from './ResumePdfDocument';

type PdfElement = ReactElement<{
  children?: ReactNode;
  style?: Record<string, unknown>;
}>;

function childAt(element: PdfElement, index: number): PdfElement {
  return Children.toArray(element.props.children)[index] as PdfElement;
}

function createClassicResume(): ResumeDocument {
  const content = createDefaultContent();
  content.profile = {
    fullName: '林清清',
    targetRole: '前端开发工程师',
    phone: '13800000000',
    email: 'qingqing@example.com',
    location: '',
    links: [],
  };
  return {
    id: 'guest-primary',
    title: '经典简历',
    status: 'draft',
    revision: 1,
    hasAvatar: true,
    templateId: 'classic-professional',
    exportCount: 0,
    contentVersion: 2,
    content,
    createdAt: '2026-07-29T00:00:00Z',
    updatedAt: '2026-07-29T00:00:00Z',
  };
}

describe('ResumePdfDocument classic header layout', () => {
  it('centers identity across the page and overlays the avatar at the right edge', () => {
    const resume = createClassicResume();
    const presentation = createResumePresentation(resume.content.formatting, true);
    const document = ResumePdfDocument({
      avatar: 'data:image/jpeg;base64,avatar',
      resume,
    }) as PdfElement;
    const page = childAt(document, 0);
    const header = childAt(page, 0);
    const identity = childAt(header, 0);
    const avatar = childAt(header, 1);
    const expectedInset = pxToPt(presentation.profileAvatarInsetPx);

    expect(header.props.style).toMatchObject({
      minHeight: pxToPt(presentation.photoHeightPx + presentation.headerPaddingBottomPx),
      position: 'relative',
    });
    expect(identity.props.style).toMatchObject({
      paddingLeft: expectedInset,
      paddingRight: expectedInset,
      width: '100%',
    });
    expect(avatar.props.style).toMatchObject({
      position: 'absolute',
      right: 0,
      top: 0,
    });
  });
});
