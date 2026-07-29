import 'fake-indexeddb/auto';

import { deleteDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';

import { createDefaultContent } from '../model/resume.model';
import type { ResumeDocument, ResumeImportEnvelope } from '../model/resume.types';
import {
  GUEST_DATABASE_NAME,
  GuestResumeConflictError,
  createGuestResumeService,
  openGuestDatabase,
} from './guest-resume.service';

function createDocument(overrides: Partial<ResumeDocument> = {}): ResumeDocument {
  return {
    id: 'guest-primary',
    title: '我的简历',
    status: 'draft',
    revision: 1,
    hasAvatar: false,
    templateId: 'modern-editorial',
    exportCount: 0,
    contentVersion: 2,
    content: createDefaultContent(),
    createdAt: '2026-07-28T00:00:00.000Z',
    updatedAt: '2026-07-28T00:00:00.000Z',
    ...overrides,
  };
}

describe('guest resume service', () => {
  beforeEach(async () => {
    await deleteDB(GUEST_DATABASE_NAME);
  });

  it('creates one local resume and restores it on the next load', async () => {
    const firstService = createGuestResumeService();
    const created = await firstService.load();
    expect(created.durability).toBe('persistent');
    expect(created.document).toMatchObject({
      id: 'guest-primary',
      revision: 1,
      contentVersion: 2,
      hasAvatar: false,
    });

    created.document.title = '本地前端简历';
    const saved = await firstService.save(created.document, created.document.revision);
    const secondService = createGuestResumeService();
    const restored = await secondService.load();

    expect(saved.document.revision).toBe(2);
    expect(restored.document.title).toBe('本地前端简历');
    expect(restored.document.revision).toBe(2);
  });

  it('stores the cropped avatar as a Blob and deletes it transactionally', async () => {
    const service = createGuestResumeService();
    const loaded = await service.load();
    const avatar = new Blob(['jpeg-bytes'], { type: 'image/jpeg' });

    const withAvatar = await service.putAvatar(loaded.document, avatar);
    expect(withAvatar.document.hasAvatar).toBe(true);
    expect(withAvatar.avatar).toBeInstanceOf(Blob);
    expect(await withAvatar.avatar?.text()).toBe('jpeg-bytes');

    const withoutAvatar = await service.deleteAvatar(withAvatar.document);
    expect(withoutAvatar.document.hasAvatar).toBe(false);
    expect(withoutAvatar.avatar).toBeNull();
  });

  it('replaces document and avatar together when importing v2 JSON', async () => {
    const service = createGuestResumeService();
    const loaded = await service.load();
    const envelope: ResumeImportEnvelope = {
      version: 2,
      title: '导入的简历',
      templateId: 'classic-professional',
      content: createDefaultContent(),
      avatar: `data:image/jpeg;base64,${btoa('avatar')}`,
    };

    const imported = await service.replaceImport(
      envelope,
      loaded.document.revision,
      loaded.document,
    );

    expect(imported.document).toMatchObject({
      title: '导入的简历',
      templateId: 'classic-professional',
      hasAvatar: true,
      revision: 2,
    });
    expect(await imported.avatar?.text()).toBe('avatar');
  });

  it('rejects a stale revision instead of overwriting another tab', async () => {
    const firstTab = createGuestResumeService();
    const secondTab = createGuestResumeService();
    const firstSnapshot = await firstTab.load();
    const secondSnapshot = await secondTab.load();

    await firstTab.save(
      { ...firstSnapshot.document, title: '第一个标签页' },
      firstSnapshot.document.revision,
    );

    await expect(
      secondTab.save(
        { ...secondSnapshot.document, title: '第二个标签页' },
        secondSnapshot.document.revision,
      ),
    ).rejects.toBeInstanceOf(GuestResumeConflictError);
  });

  it('falls back to a volatile session when IndexedDB cannot be opened', async () => {
    const service = createGuestResumeService({
      openDatabase: async () => {
        throw new DOMException('quota exhausted', 'QuotaExceededError');
      },
      createDocument: () => createDocument(),
    });

    const loaded = await service.load();
    loaded.document.title = '临时会话';
    const saved = await service.save(loaded.document, loaded.document.revision);
    const restored = await service.load();

    expect(saved.durability).toBe('volatile');
    expect(restored.document.title).toBe('临时会话');
    expect(restored.document.revision).toBe(2);
  });

  it('retries IndexedDB on a later save and returns to persistent storage', async () => {
    let available = false;
    const service = createGuestResumeService({
      openDatabase: () => {
        if (!available) throw new DOMException('temporarily unavailable', 'InvalidStateError');
        return openGuestDatabase();
      },
      createDocument: () => createDocument(),
    });

    const volatile = await service.load();
    available = true;
    const recovered = await service.save(
      { ...volatile.document, title: '恢复持久化' },
      volatile.document.revision,
    );
    const restored = await createGuestResumeService().load();

    expect(recovered.durability).toBe('persistent');
    expect(restored.document.title).toBe('恢复持久化');
  });

  it('keeps the in-memory avatar when a later IndexedDB write fails', async () => {
    let available = true;
    const service = createGuestResumeService({
      openDatabase: () => {
        if (!available) throw new DOMException('quota exhausted', 'QuotaExceededError');
        return openGuestDatabase();
      },
    });
    const loaded = await service.load();
    const withAvatar = await service.putAvatar(
      loaded.document,
      new Blob(['cropped-avatar'], { type: 'image/jpeg' }),
    );

    available = false;
    const volatile = await service.save(
      { ...withAvatar.document, title: '内存稿' },
      withAvatar.document.revision,
    );

    expect(volatile.durability).toBe('volatile');
    expect(volatile.document.hasAvatar).toBe(true);
    expect(await volatile.avatar?.text()).toBe('cropped-avatar');
  });

  it('rejects legacy import content without replacing the current resume', async () => {
    const service = createGuestResumeService();
    const loaded = await service.load();

    await expect(
      service.replaceImport(
        { version: 1, title: '旧简历' } as unknown as ResumeImportEnvelope,
        loaded.document.revision,
        loaded.document,
      ),
    ).rejects.toThrow();
    expect((await service.load()).document.title).toBe(loaded.document.title);
  });
});
