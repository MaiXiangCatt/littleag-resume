import { FileWarning, LoaderCircle, RefreshCw } from 'lucide-react';

import { usePdfFrameFallback } from '../hooks/usePdfFrameFallback';
import type { ResumePdfPreviewController } from '../hooks/useResumePdfPreview';
import { Button } from '@/shared/ui/button';

export function GuestPdfPreview({ preview }: { preview: ResumePdfPreviewController }) {
  usePdfFrameFallback(preview);
  const assets = [preview.current, preview.pending].filter(
    (asset, index, values) =>
      asset && values.findIndex((candidate) => candidate?.url === asset.url) === index,
  );

  return (
    <div className="relative mx-auto h-full min-h-[760px] w-full max-w-[794px] overflow-hidden bg-white">
      {assets.map((asset) =>
        asset ? (
          <iframe
            className={
              asset.url === preview.current?.url
                ? 'h-full w-full border-0'
                : 'invisible absolute inset-0 h-full w-full border-0'
            }
            key={asset.url}
            onLoad={asset.url === preview.pending?.url ? preview.commitPending : undefined}
            src={`${asset.url}#toolbar=0&navpanes=0&view=FitH`}
            title={`游客 PDF 预览 ${asset.key}`}
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
