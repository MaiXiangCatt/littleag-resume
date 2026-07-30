import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ResumePdfPreviewController } from '../hooks/useResumePdfPreview';
import { LocalPdfPreview } from './LocalPdfPreview';

vi.mock('../hooks/usePdfCanvasDocument', () => ({
  usePdfCanvasDocument: () => ({
    containerRef: { current: null },
    getCanvasRef: () => () => undefined,
    getPageRef: () => () => undefined,
    pages: [{ height: 842, pageNumber: 1, width: 595 }],
    renderedPages: new Set([1]),
  }),
}));

function createPreview(
  values: Partial<ResumePdfPreviewController> = {},
): ResumePdfPreviewController {
  return {
    commitPending: vi.fn(),
    current: { blob: new Blob(['pdf']), key: '1:0' },
    error: null,
    getLatestBlob: vi.fn(),
    pending: null,
    renderRevision: 0,
    reportRenderError: vi.fn(),
    retry: vi.fn(),
    status: 'ready',
    ...values,
  };
}

describe('LocalPdfPreview', () => {
  it('renders an accessible canvas without browser PDF embedding elements', () => {
    const view = render(<LocalPdfPreview preview={createPreview()} />);

    expect(screen.getByRole('img', { name: 'PDF 第 1 页预览' })).toBeInTheDocument();
    expect(view.container.querySelector('iframe, object, embed')).toBeNull();
  });

  it('keeps the current canvas visible and offers retry after an update error', () => {
    const retry = vi.fn();
    render(
      <LocalPdfPreview
        preview={createPreview({
          error: 'PDF 预览绘制失败',
          retry,
          status: 'error',
        })}
      />,
    );

    expect(screen.getByRole('img', { name: 'PDF 第 1 页预览' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
