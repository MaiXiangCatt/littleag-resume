import { useEffect } from 'react';

import type { ResumePdfPreviewController } from './useResumePdfPreview';

export function usePdfFrameFallback(preview: ResumePdfPreviewController) {
  const pendingUrl = preview.pending?.url;

  useEffect(() => {
    if (!pendingUrl) return;
    // Chromium's built-in PDF viewer does not consistently fire iframe load for blob URLs.
    // Prefer the event, then reveal the already-generated Blob after a short safety window.
    const timer = window.setTimeout(preview.commitPending, 750);
    return () => window.clearTimeout(timer);
  }, [pendingUrl, preview.commitPending]);
}
