import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResumePdfAsset } from './useResumePdfPreview';
import { usePdfCanvasDocument } from './usePdfCanvasDocument';

const canvasMock = vi.hoisted(() => ({
  destroy: vi.fn<() => Promise<void>>(),
  open: vi.fn(),
  renderPage: vi.fn(),
}));

vi.mock('../service/pdf-canvas.service', () => ({
  openPdfCanvasDocument: canvasMock.open,
}));

class ResizeObserverMock {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  disconnect() {}
  observe(target: Element) {
    this.callback(
      [{ contentRect: target.getBoundingClientRect(), target } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
}

class IntersectionObserverMock {
  private readonly callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  disconnect() {}
  observe(target: Element) {
    this.callback(
      [
        {
          isIntersecting: true,
          target,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
  takeRecords() {
    return [];
  }
  unobserve() {}
}

function Harness({
  asset,
  firstPageOnly,
  onError,
  onFirstPageReady,
  renderRevision = 0,
}: {
  asset: ResumePdfAsset;
  firstPageOnly: boolean;
  onError: (key: string, error: unknown) => void;
  onFirstPageReady: (key: string) => void;
  renderRevision?: number;
}) {
  const { containerRef, getCanvasRef, getPageRef, pages, renderedPages } = usePdfCanvasDocument({
    asset,
    firstPageOnly,
    onError,
    onFirstPageReady,
    renderRevision,
  });
  return (
    <div ref={containerRef}>
      {pages.map((page) => (
        <div
          data-page-number={page.pageNumber}
          key={page.pageNumber}
          ref={getPageRef(page.pageNumber)}
        >
          <canvas
            data-rendered={renderedPages.has(page.pageNumber)}
            ref={getCanvasRef(page.pageNumber)}
          />
        </div>
      ))}
    </div>
  );
}

describe('usePdfCanvasDocument', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 842,
      height: 842,
      left: 0,
      right: 595,
      top: 0,
      width: 595,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    canvasMock.destroy.mockReset().mockResolvedValue(undefined);
    canvasMock.renderPage.mockReset().mockImplementation(() => ({
      cancel: vi.fn(),
      promise: Promise.resolve(),
    }));
    canvasMock.open.mockReset().mockImplementation(async () => ({
      destroy: canvasMock.destroy,
      pages: [
        { height: 842, pageNumber: 1, width: 595 },
        { height: 842, pageNumber: 2, width: 595 },
      ],
      renderPage: canvasMock.renderPage,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the first page eagerly, then renders intersecting pages after commit', async () => {
    const asset = { blob: new Blob(['pdf']), key: '1:0' };
    const onError = vi.fn();
    const onFirstPageReady = vi.fn();
    const view = render(
      <Harness asset={asset} firstPageOnly onError={onError} onFirstPageReady={onFirstPageReady} />,
    );

    await waitFor(() => expect(onFirstPageReady).toHaveBeenCalledWith('1:0'));
    expect(canvasMock.renderPage).toHaveBeenCalledWith(1, expect.any(HTMLCanvasElement), 595, 1);
    expect(canvasMock.renderPage).not.toHaveBeenCalledWith(
      2,
      expect.any(HTMLCanvasElement),
      expect.any(Number),
      expect.any(Number),
    );

    view.rerender(
      <Harness
        asset={asset}
        firstPageOnly={false}
        onError={onError}
        onFirstPageReady={onFirstPageReady}
      />,
    );
    await waitFor(() =>
      expect(canvasMock.renderPage).toHaveBeenCalledWith(2, expect.any(HTMLCanvasElement), 595, 1),
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it('destroys the previous document and ignores its late first-page completion', async () => {
    let finishFirstRender: (() => void) | undefined;
    canvasMock.renderPage.mockImplementationOnce(() => ({
      cancel: vi.fn(),
      promise: new Promise<void>((resolve) => {
        finishFirstRender = resolve;
      }),
    }));
    const firstAsset = { blob: new Blob(['first']), key: '1:0' };
    const secondAsset = { blob: new Blob(['second']), key: '2:0' };
    const onFirstPageReady = vi.fn();
    const view = render(
      <Harness
        asset={firstAsset}
        firstPageOnly
        onError={vi.fn()}
        onFirstPageReady={onFirstPageReady}
      />,
    );

    await waitFor(() => expect(canvasMock.renderPage).toHaveBeenCalledTimes(1));
    view.rerender(
      <Harness
        asset={secondAsset}
        firstPageOnly
        onError={vi.fn()}
        onFirstPageReady={onFirstPageReady}
      />,
    );
    await waitFor(() => expect(canvasMock.destroy).toHaveBeenCalled());
    await act(async () => finishFirstRender?.());
    expect(onFirstPageReady).not.toHaveBeenCalledWith('1:0');
    await waitFor(() => expect(onFirstPageReady).toHaveBeenCalledWith('2:0'));
  });
});
