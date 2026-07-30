import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfMock = vi.hoisted(() => {
  const render = vi.fn();
  const cleanupPage = vi.fn();
  const cleanupDocument = vi.fn();
  const destroy = vi.fn();
  const getPage = vi.fn();
  const getDocument = vi.fn();
  const workerOptions = { workerSrc: '' };
  return {
    cleanupDocument,
    cleanupPage,
    destroy,
    getDocument,
    getPage,
    render,
    workerOptions,
  };
});

vi.mock('pdfjs-dist', () => ({
  getDocument: pdfMock.getDocument,
  GlobalWorkerOptions: pdfMock.workerOptions,
}));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: '/assets/pdf.worker.test.mjs',
}));

import { openPdfCanvasDocument } from './pdf-canvas.service';

describe('pdf-canvas.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const page = {
      cleanup: pdfMock.cleanupPage,
      getViewport: ({ scale }: { scale: number }) => ({
        height: 842 * scale,
        width: 595 * scale,
      }),
      render: pdfMock.render,
    };
    pdfMock.getPage.mockResolvedValue(page);
    pdfMock.render.mockReturnValue({
      cancel: vi.fn(),
      promise: Promise.resolve(),
    });
    pdfMock.cleanupDocument.mockResolvedValue(undefined);
    pdfMock.destroy.mockResolvedValue(undefined);
    pdfMock.getDocument.mockReturnValue({
      destroy: pdfMock.destroy,
      promise: Promise.resolve({
        cleanup: pdfMock.cleanupDocument,
        getPage: pdfMock.getPage,
        numPages: 2,
      }),
    });
  });

  it('opens every page, configures the bundled worker and caps HiDPI rendering at 2x', async () => {
    const document = await openPdfCanvasDocument(new Blob(['pdf'], { type: 'application/pdf' }));

    expect(pdfMock.workerOptions.workerSrc).toBe('/assets/pdf.worker.test.mjs');
    expect(document.pages).toEqual([
      { height: 842, pageNumber: 1, width: 595 },
      { height: 842, pageNumber: 2, width: 595 },
    ]);

    const realCanvas = window.document.createElement('canvas');
    const task = document.renderPage(1, realCanvas, 595, 3);
    await task.promise;

    expect(realCanvas.width).toBe(1190);
    expect(realCanvas.height).toBe(1684);
    expect(pdfMock.render).toHaveBeenCalledWith(
      expect.objectContaining({
        canvas: realCanvas,
        transform: [2, 0, 0, 2, 0, 0],
      }),
    );
    await document.destroy();
    expect(pdfMock.cleanupPage).toHaveBeenCalledTimes(2);
    expect(pdfMock.cleanupDocument).toHaveBeenCalledOnce();
    expect(pdfMock.destroy).toHaveBeenCalledOnce();
  });
});
