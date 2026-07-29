import type { ResumeDocument, ResumeImportEnvelope } from './resume.types';

export type ResumeEditorMode = 'cloud' | 'guest';
export type PersistenceDurability = 'persistent' | 'volatile';

export type ResumeEditorSnapshot = {
  avatar: Blob | null;
  document: ResumeDocument;
  durability: PersistenceDurability;
};

export type ResumeEditorPersistence = {
  deleteAvatar: (document: ResumeDocument) => Promise<ResumeEditorSnapshot>;
  load: () => Promise<ResumeEditorSnapshot>;
  exportPdf?: (document: ResumeDocument) => Promise<Blob>;
  refreshMetadata?: () => Promise<ResumeDocument>;
  overwrite: (document: ResumeDocument) => Promise<ResumeEditorSnapshot>;
  putAvatar: (document: ResumeDocument, avatar: Blob) => Promise<ResumeEditorSnapshot>;
  replaceImport: (
    envelope: ResumeImportEnvelope,
    document: ResumeDocument,
  ) => Promise<ResumeEditorSnapshot>;
  save: (document: ResumeDocument, expectedRevision: number) => Promise<ResumeEditorSnapshot>;
};
