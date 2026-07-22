import { useCallback, useEffect, useRef } from 'react';

import { ApiError } from '@/shared/http/http.client';

import { normalizeContent } from '../model/resume.model';
import type { ResumeDocument, ResumeImportEnvelope } from '../model/resume.types';
import { resumeEditorService } from '../service/resume-editor.service';
import { useResumeEditorStore } from '../store/resume-editor.store';

function editorError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 103001) return '这份简历不存在或已被删除';
    if (error.code === 103004) return '简历内容格式不正确';
    return error.message || '操作失败，请稍后重试';
  }
  return '网络开小差了，请稍后重试';
}

export function useResumeEditor(resumeId: string) {
  const document = useResumeEditorStore((state) => state.document);
  const changeVersion = useResumeEditorStore((state) => state.changeVersion);
  const saveStatus = useResumeEditorStore((state) => state.saveStatus);
  const timerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);

  const load = useCallback(async () => {
    useResumeEditorStore.getState().setLoading();
    try {
      const loaded = await resumeEditorService.get(resumeId);
      useResumeEditorStore.getState().load({ ...loaded, content: normalizeContent(loaded.content) });
    } catch (error) {
      useResumeEditorStore.getState().loadFailed(editorError(error));
    }
  }, [resumeId]);

  useEffect(() => {
    void load();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      useResumeEditorStore.getState().reset();
    };
  }, [load]);

  // The callback schedules itself to serialize queued saves; React Compiler cannot safely rewrite that identity.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const flushSave = useCallback(async () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const state = useResumeEditorStore.getState();
    if (!state.document || !['dirty', 'failed'].includes(state.saveStatus)) return;
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    savingRef.current = true;
    const snapshot = structuredClone(state.document);
    const snapshotVersion = state.changeVersion;
    state.setSaving();
    try {
      const saved = await resumeEditorService.update(snapshot);
      useResumeEditorStore.getState().applySaved(saved, snapshotVersion);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) useResumeEditorStore.getState().setConflict();
      else useResumeEditorStore.getState().setSaveFailed(editorError(error));
    } finally {
      savingRef.current = false;
      if (pendingRef.current || useResumeEditorStore.getState().saveStatus === 'dirty') {
        pendingRef.current = false;
        window.setTimeout(() => void flushSave(), 0);
      }
    }
  }, []);

  useEffect(() => {
    if (!document || saveStatus !== 'dirty') return;
    timerRef.current = window.setTimeout(() => void flushSave(), 1000);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [changeVersion, document, flushSave, saveStatus]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const current = useResumeEditorStore.getState().saveStatus;
      if (!['dirty', 'saving', 'failed'].includes(current)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const edit = useCallback((updater: (document: ResumeDocument) => ResumeDocument, immediate = false) => {
    useResumeEditorStore.getState().updateDraft(updater);
    if (immediate) window.setTimeout(() => void flushSave(), 0);
  }, [flushSave]);

  const reloadServer = useCallback(() => void load(), [load]);
  const overwriteServer = useCallback(async () => {
    const local = useResumeEditorStore.getState().document;
    if (!local) return;
    try {
      const server = await resumeEditorService.get(resumeId);
      useResumeEditorStore.getState().updateDraft(() => ({ ...local, revision: server.revision }));
      await flushSave();
    } catch (error) {
      useResumeEditorStore.getState().setSaveFailed(editorError(error));
    }
  }, [flushSave, resumeId]);

  const replaceImport = useCallback(async (envelope: ResumeImportEnvelope) => {
    const current = useResumeEditorStore.getState().document;
    if (!current) return;
    const imported = await resumeEditorService.replaceImport(resumeId, current.revision, envelope);
    useResumeEditorStore.getState().replaceDocument({ ...imported, content: normalizeContent(imported.content) });
  }, [resumeId]);

  return { edit, flushSave, load, overwriteServer, reloadServer, replaceImport };
}
