import { useCallback, useEffect, useRef, useState } from 'react';

import type { ResumeDocument } from '../model/resume.types';

export type ResumePdfAsset = {
  blob: Blob;
  key: string;
  url: string;
};

type PdfPreviewStatus = 'idle' | 'generating' | 'loading' | 'ready' | 'error';

type PdfInput = {
  avatar: string | null;
  document: ResumeDocument;
  key: string;
};

export function useResumePdfPreview({
  active,
  avatar,
  avatarRevision,
  document,
  documentVersion = document?.revision ?? 0,
}: {
  active: boolean;
  avatar: string | null;
  avatarRevision: number;
  document: ResumeDocument | null;
  documentVersion?: number;
}) {
  const [current, setCurrent] = useState<ResumePdfAsset | null>(null);
  const [pending, setPending] = useState<ResumePdfAsset | null>(null);
  const [status, setStatus] = useState<PdfPreviewStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [generationTick, setGenerationTick] = useState(0);
  const currentRef = useRef<ResumePdfAsset | null>(null);
  const pendingRef = useRef<ResumePdfAsset | null>(null);
  const latestInputRef = useRef<PdfInput | null>(null);
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef<Promise<Blob> | null>(null);
  const runningKeyRef = useRef<string | null>(null);
  const queuedRef = useRef(false);
  const generatedOnceRef = useRef(false);

  const publish = useCallback((blob: Blob, key: string) => {
    const next = { blob, key, url: URL.createObjectURL(blob) };
    if (pendingRef.current) URL.revokeObjectURL(pendingRef.current.url);
    pendingRef.current = next;
    setPending(next);
    setStatus('loading');
    setError(null);
  }, []);

  const generate = useCallback(
    async (input: PdfInput): Promise<Blob> => {
      if (pendingRef.current?.key === input.key) return pendingRef.current.blob;
      if (currentRef.current?.key === input.key) return currentRef.current.blob;
      if (runningRef.current) {
        if (runningKeyRef.current === input.key) return runningRef.current;
        queuedRef.current = true;
        return runningRef.current;
      }

      setStatus('generating');
      setError(null);
      runningKeyRef.current = input.key;
      const operation = import('../service/resume-pdf.service')
        .then(({ createResumePdfBlob }) => createResumePdfBlob(input.document, input.avatar))
        .then((blob) => {
          generatedOnceRef.current = true;
          if (latestInputRef.current?.key === input.key) publish(blob, input.key);
          return blob;
        })
        .catch((generationError: unknown) => {
          setStatus(currentRef.current ? 'ready' : 'error');
          setError(generationError instanceof Error ? generationError.message : 'PDF 预览生成失败');
          throw generationError;
        })
        .finally(() => {
          runningRef.current = null;
          runningKeyRef.current = null;
          if (queuedRef.current) {
            queuedRef.current = false;
            setGenerationTick((tick) => tick + 1);
          }
        });
      runningRef.current = operation;
      return operation;
    },
    [publish],
  );

  useEffect(() => {
    if (!active || !document) return;
    const input = {
      avatar,
      document: structuredClone(document),
      key: `${documentVersion}:${avatarRevision}`,
    };
    latestInputRef.current = input;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(
      () => void generate(input).catch(() => undefined),
      generatedOnceRef.current ? 800 : 0,
    );
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [active, avatar, avatarRevision, document, documentVersion, generate, generationTick]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (currentRef.current) URL.revokeObjectURL(currentRef.current.url);
      if (pendingRef.current) URL.revokeObjectURL(pendingRef.current.url);
    },
    [],
  );

  const commitPending = useCallback(() => {
    const next = pendingRef.current;
    if (!next) return;
    const previous = currentRef.current;
    currentRef.current = next;
    pendingRef.current = null;
    setCurrent(next);
    setPending(null);
    setStatus('ready');
    if (previous) URL.revokeObjectURL(previous.url);
  }, []);

  const retry = useCallback(() => {
    if (!latestInputRef.current) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    void generate(latestInputRef.current).catch(() => undefined);
  }, [generate]);

  const getLatestBlob = useCallback(async () => {
    const input = latestInputRef.current;
    if (!input) throw new Error('简历尚未加载');
    if (pendingRef.current?.key === input.key) return pendingRef.current.blob;
    if (currentRef.current?.key === input.key) return currentRef.current.blob;
    if (runningRef.current) {
      await runningRef.current.catch(() => undefined);
      if (pendingRef.current?.key === input.key) return pendingRef.current.blob;
      if (currentRef.current?.key === input.key) return currentRef.current.blob;
    }
    return generate(input);
  }, [generate]);

  return {
    commitPending,
    current,
    error,
    getLatestBlob,
    pending,
    retry,
    status,
  };
}

export type ResumePdfPreviewController = ReturnType<typeof useResumePdfPreview>;
