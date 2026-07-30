import { FileWarning, LoaderCircle, RefreshCw } from 'lucide-react';

import { usePdfCanvasDocument } from '../hooks/usePdfCanvasDocument';
import type { ResumePdfAsset } from '../hooks/useResumePdfPreview';
import type { ResumePdfPreviewController } from '../hooks/useResumePdfPreview';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

export function LocalPdfPreview({ preview }: { preview: ResumePdfPreviewController }) {
  const assets = [preview.current, preview.pending].filter(
    (asset, index, values) =>
      asset && values.findIndex((candidate) => candidate?.key === asset.key) === index,
  );

  return (
    <div className="relative h-full min-h-[760px] w-full overflow-hidden">
      {assets.map((asset) =>
        asset ? (
          <PdfCanvasAsset
            asset={asset}
            current={asset.key === preview.current?.key}
            key={asset.key}
            onError={preview.reportRenderError}
            onFirstPageReady={preview.commitPending}
            renderRevision={preview.renderRevision}
          />
        ) : null,
      )}

      {!preview.current && !preview.pending && preview.status !== 'error' ? (
        <div className="grid h-full min-h-[760px] place-items-center bg-[#f8f6f7]">
          <div className="text-center text-[#756b72]">
            <LoaderCircle className="mx-auto animate-spin text-[#bf301e]" size={28} />
            <p className="mt-3 text-sm">正在生成第一版 PDF…</p>
          </div>
        </div>
      ) : null}

      {preview.status === 'generating' || preview.status === 'loading' ? (
        <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full border border-[#ead8d4] bg-white/95 px-3 py-1.5 text-xs font-medium text-[#bf301e] shadow-sm">
          <LoaderCircle className="animate-spin" size={12} />
          正在更新 PDF
        </div>
      ) : null}

      {preview.error ? (
        <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/95 p-4 text-amber-950 shadow-lg">
          <div className="flex min-w-0 items-start gap-3">
            <FileWarning className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="text-sm font-semibold">PDF 预览更新失败</p>
              <p className="mt-1 truncate text-xs text-amber-800">{preview.error}</p>
            </div>
          </div>
          <Button onClick={preview.retry} size="sm" type="button" variant="outline">
            <RefreshCw size={14} />
            重试
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PdfCanvasAsset({
  asset,
  current,
  onError,
  onFirstPageReady,
  renderRevision,
}: {
  asset: ResumePdfAsset;
  current: boolean;
  onError: (key: string, error: unknown) => void;
  onFirstPageReady: (key: string) => void;
  renderRevision: number;
}) {
  const { containerRef, getCanvasRef, getPageRef, pages, renderedPages } = usePdfCanvasDocument({
    asset,
    firstPageOnly: !current,
    onError,
    onFirstPageReady,
    renderRevision,
  });

  return (
    <div
      className={cn(
        'h-full w-full overflow-y-auto',
        current ? 'relative' : 'invisible absolute inset-0',
      )}
      data-preview-key={asset.key}
      data-testid="local-pdf-canvas-preview"
    >
      <div className="mx-auto flex w-full max-w-[794px] flex-col gap-5" ref={containerRef}>
        {pages.map((page) => (
          <div
            className="relative w-full shrink-0 overflow-hidden bg-white shadow-sm"
            data-page-number={page.pageNumber}
            key={page.pageNumber}
            ref={getPageRef(page.pageNumber)}
            style={{ aspectRatio: `${page.width} / ${page.height}` }}
          >
            <canvas
              aria-label={`PDF 第 ${page.pageNumber} 页预览`}
              className="block h-auto w-full"
              data-rendered={renderedPages.has(page.pageNumber) ? 'true' : 'false'}
              ref={getCanvasRef(page.pageNumber)}
              role="img"
            />
            {!renderedPages.has(page.pageNumber) ? (
              <div className="absolute inset-0 grid place-items-center bg-white text-xs text-[#8a7e84]">
                <LoaderCircle className="animate-spin" size={18} />
                <span className="sr-only">正在绘制第 {page.pageNumber} 页</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
