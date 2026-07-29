import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '@/shared/http/http.client';

import type { ResumeEditorMode, ResumeEditorSnapshot } from '../model/resume.editor';
import type { ResumeDocument, ResumeImportEnvelope } from '../model/resume.types';
import { GuestResumeConflictError } from '../service/guest-resume.service';
import { UnsupportedResumeContentError } from '../service/resume-editor.service';
import { createResumePersistence } from '../service/resume-persistence.service';
import { useResumeEditorStore } from '../store/resume-editor.store';
import { useResumePdfPreview } from './useResumePdfPreview';

function editorError(error: unknown) {
  if (error instanceof UnsupportedResumeContentError) return error.message;
  if (error instanceof GuestResumeConflictError) return error.message;
  if (error instanceof ApiError) {
    if (error.code === 103001) return '这份简历不存在或已被删除';
    if (error.code === 103004) return '简历内容格式不正确';
    return error.message || '操作失败，请稍后重试';
  }
  if (error instanceof Error && error.message) return error.message;
  return '网络开小差了，请稍后重试';
}

type AvatarState = {
  blob: Blob | null;
  url: string | null;
};

export function useResumeEditor(resumeId: string, mode: ResumeEditorMode = 'cloud') {
  const document = useResumeEditorStore((state) => state.document);
  const changeVersion = useResumeEditorStore((state) => state.changeVersion);
  const saveStatus = useResumeEditorStore((state) => state.saveStatus);
  const durability = useResumeEditorStore((state) => state.durability);
  const persistence = useMemo(() => createResumePersistence(mode, resumeId), [mode, resumeId]);
  const [avatar, setAvatar] = useState<AvatarState>({ blob: null, url: null });
  const [avatarRevision, setAvatarRevision] = useState(0);
  const avatarRef = useRef(avatar);
  const timerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);

  const replaceAvatar = useCallback((blob: Blob | null) => {
    const previous = avatarRef.current.url;
    if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
    const next = {
      blob,
      url: blob && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : null,
    };
    avatarRef.current = next;
    setAvatar(next);
    setAvatarRevision((revision) => revision + 1);
  }, []);

  const applySnapshot = useCallback(
    (snapshot: ResumeEditorSnapshot, replaceDocument = false) => {
      const store = useResumeEditorStore.getState();
      store.setDurability(snapshot.durability);
      if (replaceDocument) store.replaceDocument(snapshot.document);
      else store.load(snapshot.document);
      replaceAvatar(snapshot.avatar);
    },
    [replaceAvatar],
  );

  const load = useCallback(async () => {
    useResumeEditorStore.getState().setLoading();
    try {
      applySnapshot(await persistence.load());
    } catch (error) {
      useResumeEditorStore.getState().loadFailed(editorError(error));
    }
  }, [applySnapshot, persistence]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(loadTimer);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      const avatarUrl = avatarRef.current.url;
      if (avatarUrl?.startsWith('blob:')) URL.revokeObjectURL(avatarUrl);
      useResumeEditorStore.getState().reset();
    };
  }, [load]);

  // The callback schedules itself to serialize queued saves; React Compiler cannot safely rewrite that identity.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const flushSave = useCallback(async () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const state = useResumeEditorStore.getState();
    const retriesVolatileStorage = state.durability === 'volatile' && state.saveStatus === 'saved';
    if (
      !state.document ||
      (!['dirty', 'failed'].includes(state.saveStatus) && !retriesVolatileStorage)
    ) {
      return;
    }
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    savingRef.current = true;
    const snapshot = structuredClone(state.document);
    const snapshotVersion = state.changeVersion;
    state.setSaving();
    try {
      const saved = await persistence.save(snapshot, snapshot.revision);
      const latest = useResumeEditorStore.getState();
      latest.setDurability(saved.durability);
      latest.applySaved(saved.document, snapshotVersion);
    } catch (error) {
      if (
        error instanceof GuestResumeConflictError ||
        (error instanceof ApiError && error.status === 409)
      ) {
        useResumeEditorStore.getState().setConflict();
      } else {
        useResumeEditorStore.getState().setSaveFailed(editorError(error));
      }
    } finally {
      savingRef.current = false;
      if (pendingRef.current || useResumeEditorStore.getState().saveStatus === 'dirty') {
        pendingRef.current = false;
        window.setTimeout(() => void flushSave(), 0);
      }
    }
  }, [persistence]);

  useEffect(() => {
    if (!document || saveStatus !== 'dirty') return;
    timerRef.current = window.setTimeout(() => void flushSave(), 1000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [changeVersion, document, flushSave, saveStatus]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const state = useResumeEditorStore.getState();
      const hasUnsavedWork = ['dirty', 'saving', 'failed'].includes(state.saveStatus);
      if (!hasUnsavedWork && state.durability !== 'volatile') return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const edit = useCallback(
    (updater: (document: ResumeDocument) => ResumeDocument, immediate = false) => {
      useResumeEditorStore.getState().updateDraft(updater);
      if (immediate) window.setTimeout(() => void flushSave(), 0);
    },
    [flushSave],
  );

  const reload = useCallback(() => void load(), [load]);

  const overwrite = useCallback(async () => {
    const local = useResumeEditorStore.getState().document;
    if (!local) return;
    try {
      const saved = await persistence.overwrite(local);
      useResumeEditorStore.getState().replaceDocument(saved.document);
      useResumeEditorStore.getState().setDurability(saved.durability);
      replaceAvatar(saved.avatar);
    } catch (error) {
      useResumeEditorStore.getState().setSaveFailed(editorError(error));
    }
  }, [persistence, replaceAvatar]);

  const replaceImport = useCallback(
    async (envelope: ResumeImportEnvelope) => {
      const current = useResumeEditorStore.getState().document;
      if (!current) return;
      const imported = await persistence.replaceImport(envelope, current);
      useResumeEditorStore.getState().replaceDocument(imported.document);
      useResumeEditorStore.getState().setDurability(imported.durability);
      replaceAvatar(imported.avatar);
    },
    [persistence, replaceAvatar],
  );

  const saveAvatar = useCallback(
    async (blob: Blob) => {
      await flushSave();
      const current = useResumeEditorStore.getState().document;
      if (!current) return;
      const saved = await persistence.putAvatar(current, blob);
      useResumeEditorStore.getState().mergeServerMetadata(saved.document);
      useResumeEditorStore.getState().setDurability(saved.durability);
      replaceAvatar(saved.avatar);
    },
    [flushSave, persistence, replaceAvatar],
  );

  const deleteAvatar = useCallback(async () => {
    await flushSave();
    const current = useResumeEditorStore.getState().document;
    if (!current) return;
    const saved = await persistence.deleteAvatar(current);
    useResumeEditorStore.getState().mergeServerMetadata(saved.document);
    useResumeEditorStore.getState().setDurability(saved.durability);
    replaceAvatar(saved.avatar);
  }, [flushSave, persistence, replaceAvatar]);

  const pdfPreview = useResumePdfPreview({
    active: mode === 'guest',
    avatar: avatar.url,
    avatarRevision,
    document,
    documentVersion: changeVersion,
  });

  const exportPdf = useCallback(async () => {
    const current = useResumeEditorStore.getState().document;
    if (!current) throw new Error('简历尚未加载');
    if (mode === 'guest') return pdfPreview.getLatestBlob();
    await flushSave();
    if (!persistence.exportPdf) throw new Error('PDF 导出不可用');
    const blob = await persistence.exportPdf(current);
    if (persistence.refreshMetadata) {
      useResumeEditorStore.getState().mergeServerMetadata(await persistence.refreshMetadata());
    }
    return blob;
  }, [flushSave, mode, pdfPreview, persistence]);

  const getAvatarDataUrl = useCallback(async () => {
    if (!avatarRef.current.blob) return null;
    return blobToDataUrl(avatarRef.current.blob);
  }, []);

  return {
    avatarBlob: avatar.blob,
    avatarUrl: avatar.url,
    deleteAvatar,
    durability,
    edit,
    exportPdf,
    flushSave,
    getAvatarDataUrl,
    load,
    mode,
    overwrite,
    pdfPreview,
    reload,
    replaceImport,
    saveAvatar,
  };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('无法读取头像'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
