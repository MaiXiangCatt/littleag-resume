import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import {
  createDefaultContent,
  parseImportEnvelope,
  parseResumeContent,
} from '../model/resume.model';
import type { PersistenceDurability, ResumeEditorSnapshot } from '../model/resume.editor';
import type { ResumeDocument, ResumeImportEnvelope } from '../model/resume.types';

export const GUEST_DATABASE_NAME = 'littleag-resume';
const DATABASE_VERSION = 1;
const RESUME_STORE = 'guest-resume';
const ASSET_STORE = 'guest-assets';
const PRIMARY_KEY = 'primary' as const;
const AVATAR_KEY = 'avatar' as const;

type GuestResumeRecord = {
  key: typeof PRIMARY_KEY;
  storageVersion: 1;
  document: ResumeDocument;
};

interface GuestResumeDatabase extends DBSchema {
  [RESUME_STORE]: {
    key: typeof PRIMARY_KEY;
    value: GuestResumeRecord;
  };
  [ASSET_STORE]: {
    key: typeof AVATAR_KEY;
    value: Blob;
  };
}

type GuestDatabase = IDBPDatabase<GuestResumeDatabase>;

type GuestResumeServiceOptions = {
  createDocument?: () => ResumeDocument;
  openDatabase?: () => Promise<GuestDatabase>;
};

export class GuestResumeConflictError extends Error {
  constructor() {
    super('这份本地简历已在另一个页面更新');
    this.name = 'GuestResumeConflictError';
  }
}

export function createGuestResumeService(options: GuestResumeServiceOptions = {}) {
  const createDocument = options.createDocument ?? createGuestDocument;
  const openDatabase = options.openDatabase ?? openGuestDatabase;
  let volatileSnapshot: ResumeEditorSnapshot | null = null;
  let cachedAvatar: Blob | null = null;

  function deliver(snapshot: ResumeEditorSnapshot): ResumeEditorSnapshot {
    cachedAvatar = snapshot.avatar;
    return cloneSnapshot(snapshot);
  }

  function toVolatile(
    document?: ResumeDocument,
    avatar: Blob | null = cachedAvatar,
  ): ResumeEditorSnapshot {
    const snapshot = volatileSnapshot ?? {
      document: structuredClone(document ?? createDocument()),
      avatar,
      durability: 'volatile' as const,
    };
    volatileSnapshot = snapshot;
    return deliver(snapshot);
  }

  async function withDatabase<T>(operation: (database: GuestDatabase) => Promise<T>): Promise<T> {
    const database = await openDatabase();
    try {
      return await operation(database);
    } finally {
      database.close();
    }
  }

  async function load(): Promise<ResumeEditorSnapshot> {
    if (volatileSnapshot) return deliver(volatileSnapshot);
    try {
      return await withDatabase(async (database) => {
        const transaction = database.transaction([RESUME_STORE, ASSET_STORE], 'readwrite');
        const stored = await transaction.objectStore(RESUME_STORE).get(PRIMARY_KEY);
        const document = stored ? parseStoredRecord(stored) : createDocument();
        if (!stored) {
          await transaction.objectStore(RESUME_STORE).put(toRecord(document));
        }
        const avatar = (await transaction.objectStore(ASSET_STORE).get(AVATAR_KEY)) ?? null;
        await transaction.done;
        return deliver({
          document: { ...document, hasAvatar: Boolean(avatar) },
          avatar,
          durability: 'persistent',
        });
      });
    } catch {
      return toVolatile();
    }
  }

  async function save(
    document: ResumeDocument,
    expectedRevision: number,
  ): Promise<ResumeEditorSnapshot> {
    const validated = validateDocument(document);
    if (volatileSnapshot) {
      const volatile = volatileSnapshot;
      assertRevision(volatile.document, expectedRevision);
      try {
        const recovered = await withDatabase(async (database) => {
          const transaction = database.transaction([RESUME_STORE, ASSET_STORE], 'readwrite');
          const stored = await transaction.objectStore(RESUME_STORE).get(PRIMARY_KEY);
          if (stored) assertRevision(parseStoredRecord(stored), expectedRevision);
          const saved = nextRevision(
            { ...validated, hasAvatar: Boolean(volatile.avatar) },
            expectedRevision,
          );
          await transaction.objectStore(RESUME_STORE).put(toRecord(saved));
          if (volatile.avatar) {
            await transaction.objectStore(ASSET_STORE).put(volatile.avatar, AVATAR_KEY);
          } else {
            await transaction.objectStore(ASSET_STORE).delete(AVATAR_KEY);
          }
          await transaction.done;
          return {
            document: saved,
            avatar: volatile.avatar,
            durability: 'persistent' as const,
          };
        });
        volatileSnapshot = null;
        return deliver(recovered);
      } catch (error) {
        if (error instanceof GuestResumeConflictError) throw error;
        const saved = nextRevision(validated, expectedRevision);
        volatileSnapshot = {
          ...volatile,
          document: saved,
          durability: 'volatile',
        };
        return deliver(volatileSnapshot);
      }
    }
    try {
      return await withDatabase(async (database) => {
        const transaction = database.transaction([RESUME_STORE, ASSET_STORE], 'readwrite');
        const stored = await transaction.objectStore(RESUME_STORE).get(PRIMARY_KEY);
        const current = stored ? parseStoredRecord(stored) : createDocument();
        assertRevision(current, expectedRevision);
        const avatar = (await transaction.objectStore(ASSET_STORE).get(AVATAR_KEY)) ?? null;
        const saved = nextRevision({ ...validated, hasAvatar: Boolean(avatar) }, expectedRevision);
        await transaction.objectStore(RESUME_STORE).put(toRecord(saved));
        await transaction.done;
        return deliver({ document: saved, avatar, durability: 'persistent' });
      });
    } catch (error) {
      if (error instanceof GuestResumeConflictError) throw error;
      const fallback = toVolatile(validated);
      const saved = nextRevision(fallback.document, expectedRevision);
      volatileSnapshot = { ...fallback, document: saved };
      return deliver(volatileSnapshot);
    }
  }

  async function overwrite(document: ResumeDocument): Promise<ResumeEditorSnapshot> {
    const validated = validateDocument(document);
    if (volatileSnapshot) {
      const volatile = volatileSnapshot;
      try {
        const recovered = await withDatabase(async (database) => {
          const transaction = database.transaction([RESUME_STORE, ASSET_STORE], 'readwrite');
          const stored = await transaction.objectStore(RESUME_STORE).get(PRIMARY_KEY);
          const revision = stored ? parseStoredRecord(stored).revision : volatile.document.revision;
          const saved = nextRevision(
            { ...validated, hasAvatar: Boolean(volatile.avatar) },
            revision,
          );
          await transaction.objectStore(RESUME_STORE).put(toRecord(saved));
          if (volatile.avatar) {
            await transaction.objectStore(ASSET_STORE).put(volatile.avatar, AVATAR_KEY);
          } else {
            await transaction.objectStore(ASSET_STORE).delete(AVATAR_KEY);
          }
          await transaction.done;
          return {
            document: saved,
            avatar: volatile.avatar,
            durability: 'persistent' as const,
          };
        });
        volatileSnapshot = null;
        return deliver(recovered);
      } catch {
        const saved = nextRevision(validated, volatile.document.revision);
        volatileSnapshot = { ...volatile, document: saved };
        return deliver(volatileSnapshot);
      }
    }
    try {
      return await withDatabase(async (database) => {
        const transaction = database.transaction([RESUME_STORE, ASSET_STORE], 'readwrite');
        const stored = await transaction.objectStore(RESUME_STORE).get(PRIMARY_KEY);
        const current = stored ? parseStoredRecord(stored) : createDocument();
        const avatar = (await transaction.objectStore(ASSET_STORE).get(AVATAR_KEY)) ?? null;
        const saved = nextRevision({ ...validated, hasAvatar: Boolean(avatar) }, current.revision);
        await transaction.objectStore(RESUME_STORE).put(toRecord(saved));
        await transaction.done;
        return deliver({ document: saved, avatar, durability: 'persistent' });
      });
    } catch {
      const fallback = toVolatile(validated);
      const saved = nextRevision(fallback.document, fallback.document.revision);
      volatileSnapshot = { ...fallback, document: saved };
      return deliver(volatileSnapshot);
    }
  }

  async function replaceImport(
    envelope: ResumeImportEnvelope,
    expectedRevision: number,
    fallbackDocument: ResumeDocument,
  ): Promise<ResumeEditorSnapshot> {
    const parsed = parseImportEnvelope(envelope);
    const avatar = parsed.avatar ? dataUrlToBlob(parsed.avatar) : null;
    const replace = (current: ResumeDocument) =>
      nextRevision(
        {
          ...current,
          title: parsed.title,
          templateId: parsed.templateId,
          content: parsed.content,
          contentVersion: 2,
          hasAvatar: Boolean(avatar),
        },
        expectedRevision,
      );

    if (volatileSnapshot) {
      assertRevision(volatileSnapshot.document, expectedRevision);
      volatileSnapshot = {
        document: replace(volatileSnapshot.document),
        avatar,
        durability: 'volatile',
      };
      return deliver(volatileSnapshot);
    }
    try {
      return await withDatabase(async (database) => {
        const transaction = database.transaction([RESUME_STORE, ASSET_STORE], 'readwrite');
        const stored = await transaction.objectStore(RESUME_STORE).get(PRIMARY_KEY);
        const current = stored ? parseStoredRecord(stored) : fallbackDocument;
        assertRevision(current, expectedRevision);
        const document = replace(current);
        await transaction.objectStore(RESUME_STORE).put(toRecord(document));
        if (avatar) await transaction.objectStore(ASSET_STORE).put(avatar, AVATAR_KEY);
        else await transaction.objectStore(ASSET_STORE).delete(AVATAR_KEY);
        await transaction.done;
        return deliver({ document, avatar, durability: 'persistent' });
      });
    } catch (error) {
      if (error instanceof GuestResumeConflictError) throw error;
      volatileSnapshot = {
        document: replace(fallbackDocument),
        avatar,
        durability: 'volatile',
      };
      return deliver(volatileSnapshot);
    }
  }

  async function putAvatar(document: ResumeDocument, avatar: Blob): Promise<ResumeEditorSnapshot> {
    return updateAvatar(document, avatar);
  }

  async function deleteAvatar(document: ResumeDocument): Promise<ResumeEditorSnapshot> {
    return updateAvatar(document, null);
  }

  async function updateAvatar(
    document: ResumeDocument,
    avatar: Blob | null,
  ): Promise<ResumeEditorSnapshot> {
    if (volatileSnapshot) {
      assertRevision(volatileSnapshot.document, document.revision);
      const saved = nextRevision({ ...document, hasAvatar: Boolean(avatar) }, document.revision);
      volatileSnapshot = { document: saved, avatar, durability: 'volatile' };
      return deliver(volatileSnapshot);
    }
    try {
      return await withDatabase(async (database) => {
        const transaction = database.transaction([RESUME_STORE, ASSET_STORE], 'readwrite');
        const stored = await transaction.objectStore(RESUME_STORE).get(PRIMARY_KEY);
        const current = stored ? parseStoredRecord(stored) : document;
        assertRevision(current, document.revision);
        const saved = nextRevision(
          { ...validateDocument(document), hasAvatar: Boolean(avatar) },
          document.revision,
        );
        await transaction.objectStore(RESUME_STORE).put(toRecord(saved));
        if (avatar) await transaction.objectStore(ASSET_STORE).put(avatar, AVATAR_KEY);
        else await transaction.objectStore(ASSET_STORE).delete(AVATAR_KEY);
        await transaction.done;
        return deliver({ document: saved, avatar, durability: 'persistent' });
      });
    } catch (error) {
      if (error instanceof GuestResumeConflictError) throw error;
      const fallback = toVolatile(document, avatar);
      const saved = nextRevision(
        { ...fallback.document, hasAvatar: Boolean(avatar) },
        document.revision,
      );
      volatileSnapshot = { document: saved, avatar, durability: 'volatile' };
      return deliver(volatileSnapshot);
    }
  }

  return {
    deleteAvatar,
    load,
    overwrite,
    putAvatar,
    replaceImport,
    save,
  };
}

export const guestResumeService = createGuestResumeService();

export function openGuestDatabase() {
  return openDB<GuestResumeDatabase>(GUEST_DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(RESUME_STORE)) {
        database.createObjectStore(RESUME_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(ASSET_STORE)) {
        database.createObjectStore(ASSET_STORE);
      }
    },
  });
}

function createGuestDocument(): ResumeDocument {
  const now = new Date().toISOString();
  return {
    id: 'guest-primary',
    title: '未命名简历',
    status: 'draft',
    revision: 1,
    hasAvatar: false,
    templateId: 'modern-editorial',
    exportCount: 0,
    contentVersion: 2,
    content: createDefaultContent(),
    createdAt: now,
    updatedAt: now,
  };
}

function validateDocument(document: ResumeDocument): ResumeDocument {
  return {
    ...structuredClone(document),
    id: 'guest-primary',
    contentVersion: 2,
    content: parseResumeContent(document.content),
  };
}

function parseStoredRecord(record: GuestResumeRecord): ResumeDocument {
  if (record.storageVersion !== 1 || record.document.contentVersion !== 2) {
    throw new Error('不支持的游客简历格式');
  }
  return validateDocument(record.document);
}

function toRecord(document: ResumeDocument): GuestResumeRecord {
  return {
    key: PRIMARY_KEY,
    storageVersion: 1,
    document: structuredClone(document),
  };
}

function nextRevision(document: ResumeDocument, revision: number): ResumeDocument {
  return {
    ...structuredClone(document),
    revision: revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

function assertRevision(document: ResumeDocument, expectedRevision: number) {
  if (document.revision !== expectedRevision) throw new GuestResumeConflictError();
}

function cloneSnapshot(snapshot: ResumeEditorSnapshot): ResumeEditorSnapshot {
  return {
    document: structuredClone(snapshot.document),
    avatar: snapshot.avatar,
    durability: snapshot.durability as PersistenceDurability,
  };
}

function dataUrlToBlob(value: string) {
  const [header, encoded = ''] = value.split(',', 2);
  const mime = /^data:([^;]+);base64$/.exec(header)?.[1] ?? 'application/octet-stream';
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}
