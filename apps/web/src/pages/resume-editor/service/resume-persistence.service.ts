import type {
  ResumeEditorMode,
  ResumeEditorPersistence,
  ResumeEditorSnapshot,
} from '../model/resume.editor';
import type { ResumeDocument } from '../model/resume.types';
import { guestResumeService } from './guest-resume.service';
import { resumeEditorService } from './resume-editor.service';

export function createResumePersistence(
  mode: ResumeEditorMode,
  resumeId: string,
): ResumeEditorPersistence {
  if (mode === 'guest') {
    return {
      deleteAvatar: (document) => guestResumeService.deleteAvatar(document),
      load: () => guestResumeService.load(),
      overwrite: (document) => guestResumeService.overwrite(document),
      putAvatar: (document, avatar) => guestResumeService.putAvatar(document, avatar),
      replaceImport: (envelope, document) =>
        guestResumeService.replaceImport(envelope, document.revision, document),
      save: (document, expectedRevision) => guestResumeService.save(document, expectedRevision),
    };
  }

  let avatar: Blob | null = null;
  const snapshot = (document: ResumeDocument, nextAvatar = avatar): ResumeEditorSnapshot => ({
    document,
    avatar: nextAvatar,
    durability: 'persistent',
  });

  return {
    async load() {
      const document = await resumeEditorService.get(resumeId);
      avatar = document.hasAvatar ? await resumeEditorService.getAvatar(resumeId) : null;
      return snapshot(document);
    },
    async save(document, expectedRevision) {
      return snapshot(await resumeEditorService.update(document, expectedRevision));
    },
    async overwrite(document) {
      const server = await resumeEditorService.get(resumeId);
      return snapshot(await resumeEditorService.update(document, server.revision));
    },
    async replaceImport(envelope, document) {
      const imported = await resumeEditorService.replaceImport(
        resumeId,
        document.revision,
        envelope,
      );
      avatar = envelope.avatar ? dataUrlToBlob(envelope.avatar) : null;
      return snapshot(imported);
    },
    async putAvatar(_document, nextAvatar) {
      const updated = await resumeEditorService.putAvatar(resumeId, nextAvatar);
      avatar = nextAvatar;
      return snapshot(updated);
    },
    async deleteAvatar() {
      const updated = await resumeEditorService.deleteAvatar(resumeId);
      avatar = null;
      return snapshot(updated);
    },
    exportPdf: () => resumeEditorService.exportPdf(resumeId),
    refreshMetadata: () => resumeEditorService.get(resumeId),
  };
}

function dataUrlToBlob(value: string) {
  const [header, encoded = ''] = value.split(',', 2);
  const mime = /^data:([^;]+);base64$/.exec(header)?.[1] ?? 'application/octet-stream';
  const binary = atob(encoded);
  return new Blob([Uint8Array.from(binary, (character) => character.charCodeAt(0))], {
    type: mime,
  });
}
