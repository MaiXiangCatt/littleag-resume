import { useCallback, useEffect, useRef, useState, type RefCallback, type RefObject } from 'react';

import type { ResumePdfAsset } from './useResumePdfPreview';
import type {
  PdfCanvasDocument,
  PdfCanvasPage,
  PdfCanvasRenderTask,
} from '../service/pdf-canvas.service';

const PAGE_PREFETCH_MARGIN = '100% 0px';

type PdfCanvasDocumentController = {
  containerRef: RefObject<HTMLDivElement | null>;
  getPageRef: (pageNumber: number) => RefCallback<HTMLDivElement>;
  getCanvasRef: (pageNumber: number) => RefCallback<HTMLCanvasElement>;
  pages: PdfCanvasPage[];
  renderedPages: ReadonlySet<number>;
};

export function usePdfCanvasDocument({
  asset,
  firstPageOnly,
  onError,
  onFirstPageReady,
  renderRevision,
}: {
  asset: ResumePdfAsset;
  firstPageOnly: boolean;
  onError: (key: string, error: unknown) => void;
  onFirstPageReady: (key: string) => void;
  renderRevision: number;
}): PdfCanvasDocumentController {
  const containerRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<PdfCanvasDocument | null>(null);
  const pageElementsRef = useRef(new Map<number, HTMLDivElement>());
  const canvasesRef = useRef(new Map<number, HTMLCanvasElement>());
  const visiblePagesRef = useRef(new Set<number>([1]));
  const renderTasksRef = useRef(new Map<number, PdfCanvasRenderTask>());
  const lifecycleRef = useRef(0);
  const firstPageReadyRef = useRef(false);
  const onErrorRef = useRef(onError);
  const onFirstPageReadyRef = useRef(onFirstPageReady);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pages, setPages] = useState<PdfCanvasPage[]>([]);
  const [renderedPages, setRenderedPages] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    onFirstPageReadyRef.current = onFirstPageReady;
  }, [onFirstPageReady]);

  const cancelRenders = useCallback(() => {
    for (const task of renderTasksRef.current.values()) task.cancel();
    renderTasksRef.current.clear();
  }, []);

  const renderPage = useCallback(
    async (pageNumber: number, lifecycle: number) => {
      const document = documentRef.current;
      const canvas = canvasesRef.current.get(pageNumber);
      if (!document || !canvas || containerWidth <= 0) return;

      renderTasksRef.current.get(pageNumber)?.cancel();
      const task = document.renderPage(
        pageNumber,
        canvas,
        containerWidth,
        window.devicePixelRatio || 1,
      );
      renderTasksRef.current.set(pageNumber, task);

      try {
        await task.promise;
        if (lifecycle !== lifecycleRef.current) return;
        renderTasksRef.current.delete(pageNumber);
        setRenderedPages((current) => new Set(current).add(pageNumber));
        if (pageNumber === 1 && !firstPageReadyRef.current) {
          firstPageReadyRef.current = true;
          onFirstPageReadyRef.current(asset.key);
        }
      } catch (error) {
        renderTasksRef.current.delete(pageNumber);
        if (lifecycle !== lifecycleRef.current || isRenderCancellation(error)) return;
        onErrorRef.current(asset.key, error);
      }
    },
    [asset.key, containerWidth],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateWidth = () => {
      const nextWidth = Math.floor(element.getBoundingClientRect().width);
      if (nextWidth > 0) setContainerWidth(nextWidth);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const lifecycle = lifecycleRef.current + 1;
    lifecycleRef.current = lifecycle;
    firstPageReadyRef.current = false;
    visiblePagesRef.current = new Set([1]);
    cancelRenders();

    let disposed = false;
    void import('../service/pdf-canvas.service')
      .then(({ openPdfCanvasDocument }) => openPdfCanvasDocument(asset.blob))
      .then(async (document) => {
        if (disposed || lifecycle !== lifecycleRef.current) {
          await document.destroy();
          return;
        }
        documentRef.current = document;
        setPages(document.pages);
      })
      .catch((error: unknown) => {
        if (!disposed && lifecycle === lifecycleRef.current) {
          onErrorRef.current(asset.key, error);
        }
      });

    return () => {
      disposed = true;
      lifecycleRef.current += 1;
      cancelRenders();
      const document = documentRef.current;
      documentRef.current = null;
      if (document) void document.destroy().catch(() => undefined);
    };
  }, [asset.blob, asset.key, cancelRenders, renderRevision]);

  useEffect(() => {
    if (!pages.length || containerWidth <= 0) return;
    const lifecycle = lifecycleRef.current;
    cancelRenders();
    for (const pageNumber of visiblePagesRef.current) void renderPage(pageNumber, lifecycle);
  }, [cancelRenders, containerWidth, pages, renderPage, renderRevision]);

  useEffect(() => {
    if (firstPageOnly || !pages.length || typeof IntersectionObserver === 'undefined') return;
    const lifecycle = lifecycleRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const pageNumber = Number((entry.target as HTMLElement).dataset.pageNumber);
          if (!pageNumber) continue;
          if (entry.isIntersecting) {
            visiblePagesRef.current.add(pageNumber);
            if (!renderedPages.has(pageNumber)) void renderPage(pageNumber, lifecycle);
          } else if (pageNumber !== 1) {
            visiblePagesRef.current.delete(pageNumber);
          }
        }
      },
      { rootMargin: PAGE_PREFETCH_MARGIN },
    );
    for (const element of pageElementsRef.current.values()) observer.observe(element);
    return () => observer.disconnect();
  }, [firstPageOnly, pages, renderPage, renderedPages]);

  const getPageRef = useCallback(
    (pageNumber: number): RefCallback<HTMLDivElement> =>
      (element) => {
        if (element) pageElementsRef.current.set(pageNumber, element);
        else pageElementsRef.current.delete(pageNumber);
      },
    [],
  );
  const getCanvasRef = useCallback(
    (pageNumber: number): RefCallback<HTMLCanvasElement> =>
      (canvas) => {
        if (canvas) canvasesRef.current.set(pageNumber, canvas);
        else canvasesRef.current.delete(pageNumber);
      },
    [],
  );

  return {
    containerRef,
    getCanvasRef,
    getPageRef,
    pages,
    renderedPages,
  };
}

function isRenderCancellation(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'RenderingCancelledException' || error.name === 'AbortException')
  );
}
