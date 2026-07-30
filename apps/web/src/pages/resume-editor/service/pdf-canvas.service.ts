import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type PdfCanvasPage = {
  height: number;
  pageNumber: number;
  width: number;
};

export type PdfCanvasRenderTask = {
  cancel: () => void;
  promise: Promise<void>;
};

export type PdfCanvasDocument = {
  destroy: () => Promise<void>;
  pages: PdfCanvasPage[];
  renderPage: (
    pageNumber: number,
    canvas: HTMLCanvasElement,
    cssWidth: number,
    pixelRatio: number,
  ) => PdfCanvasRenderTask;
};

export async function openPdfCanvasDocument(blob: Blob): Promise<PdfCanvasDocument> {
  const loadingTask = getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
  });
  try {
    const document = await loadingTask.promise;
    const pageCache = new Map<number, PDFPageProxy>();
    const pages = await Promise.all(
      Array.from({ length: document.numPages }, async (_, index) => {
        const pageNumber = index + 1;
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        pageCache.set(pageNumber, page);
        return {
          height: viewport.height,
          pageNumber,
          width: viewport.width,
        };
      }),
    );

    return {
      destroy: () => destroyPdfDocument(loadingTask, document, pageCache),
      pages,
      renderPage: (pageNumber, canvas, cssWidth, pixelRatio) =>
        renderPdfPage(pageCache, pageNumber, canvas, cssWidth, pixelRatio),
    };
  } catch (error) {
    await loadingTask.destroy().catch(() => undefined);
    throw error;
  }
}

async function destroyPdfDocument(
  loadingTask: PDFDocumentLoadingTask,
  document: PDFDocumentProxy,
  pageCache: Map<number, PDFPageProxy>,
) {
  for (const page of pageCache.values()) page.cleanup();
  await document.cleanup();
  await loadingTask.destroy();
}

function renderPdfPage(
  pageCache: Map<number, PDFPageProxy>,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  pixelRatio: number,
): PdfCanvasRenderTask {
  const page = pageCache.get(pageNumber);
  if (!page) throw new Error(`PDF 第 ${pageNumber} 页不存在`);

  const naturalViewport = page.getViewport({ scale: 1 });
  const scale = cssWidth / naturalViewport.width;
  const viewport = page.getViewport({ scale });
  const outputScale = Math.min(Math.max(pixelRatio, 1), 2);

  canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
  canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const renderTask: RenderTask = page.render({
    canvas,
    transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
    viewport,
  });
  return {
    cancel: () => renderTask.cancel(),
    promise: renderTask.promise,
  };
}
