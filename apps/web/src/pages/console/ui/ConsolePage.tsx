import { AlertTriangle, HardDrive, LoaderCircle, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { LOCAL_RESUME_LIMIT } from '@/pages/resume-editor/model/local-resume';
import { parseImportEnvelope } from '@/pages/resume-editor/model/resume.model';
import {
  LocalResumeLimitError,
  LocalResumeStorageError,
} from '@/pages/resume-editor/service/local-resume.service';
import {
  resumeEditorService,
  UnsupportedResumeContentError,
} from '@/pages/resume-editor/service/resume-editor.service';
import { localResumeStore } from '@/pages/resume-editor/store/local-resume.store';
import { useLocalResumeStatus } from '@/pages/resume-editor/hooks/useLocalResumeStatus';
import { useAuthStore } from '@/shared/auth/store/auth.store';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

import { useConsoleData } from '../hooks/useConsoleData';
import type {
  ConsoleDataSource,
  ConsolePageSize,
  ConsoleQueryState,
  ConsoleResumeSummary,
  ConsoleSort,
  ConsoleStatusFilter,
  Feedback,
} from '../model/console.types';
import { localConsoleService } from '../service/local-console.service';
import { resumeErrorMessage, resumeService } from '../service/resume.service';
import { ConsoleHeader } from './components/ConsoleHeader';
import {
  CreateResumeCard,
  EmptyResults,
  FeedbackNotice,
  ListError,
  Pagination,
  ResumeCard,
  ResumeGridSkeleton,
  ResumeStatsPanel,
  ResumeToolbar,
} from './components/ConsoleSections';

type ConsoleMode = 'cloud' | 'local';

type ConsolePageProps = {
  onLogout?: () => Promise<void>;
};

type LocalConsolePageProps = {
  onLogin: () => void;
};

const INITIAL_QUERY: ConsoleQueryState = {
  page: 1,
  pageSize: 6,
  query: '',
  sort: 'updated_desc',
  status: 'all',
};

const IMPORT_LIMIT_BYTES = 2 * 1024 * 1024;

export function ConsolePage({ onLogout }: ConsolePageProps) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const authError = useAuthStore((state) => state.error);

  if (status === 'loading' || status === 'idle') {
    return <ConsoleMessage>正在加载账号信息</ConsoleMessage>;
  }

  if (status === 'error') {
    return <ConsoleMessage>{authError ?? '暂时无法恢复登录状态，请刷新重试'}</ConsoleMessage>;
  }

  if (!user) {
    return <ConsoleMessage>请先登录</ConsoleMessage>;
  }

  return (
    <ResumeConsole
      dataSource={resumeService}
      errorMessage={resumeErrorMessage}
      mode="cloud"
      onLogout={onLogout}
      user={user}
    />
  );
}

export function LocalConsolePage({ onLogin }: LocalConsolePageProps) {
  const storage = useLocalResumeStatus();
  const user = useAuthStore((state) => state.user);
  const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);
  const [isClearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  async function clearLocalData() {
    if (isClearing) return;
    setClearing(true);
    setClearError(null);
    try {
      await localResumeStore.clear();
      await localResumeStore.retry();
      setClearConfirmationOpen(false);
    } catch (error) {
      setClearError(localResumeErrorMessage(error));
    } finally {
      setClearing(false);
    }
  }

  if (storage.availability === 'blocked') {
    return (
      <>
        <LocalStorageFailure
          error={storage.error}
          onClear={() => setClearConfirmationOpen(true)}
          onRetry={() => void localResumeStore.retry().catch(() => undefined)}
        />
        {clearConfirmationOpen ? (
          <Dialog onOpenChange={setClearConfirmationOpen} open>
            <DialogContent className="rounded-2xl p-6">
              <DialogTitle>清除全部本地简历？</DialogTitle>
              <DialogDescription>
                这会永久删除当前浏览器中的全部本地简历和头像，且无法恢复。
              </DialogDescription>
              {clearError ? <p className="mt-4 text-sm text-red-600">{clearError}</p> : null}
              <div className="mt-6 flex justify-end gap-3">
                <Button
                  disabled={isClearing}
                  onClick={() => setClearConfirmationOpen(false)}
                  variant="outline"
                >
                  取消
                </Button>
                <Button
                  disabled={isClearing}
                  onClick={() => void clearLocalData()}
                  variant="destructive"
                >
                  {isClearing ? (
                    <LoaderCircle className="animate-spin" size={16} />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  {isClearing ? '正在清除…' : '确认清除'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </>
    );
  }

  return (
    <ResumeConsole
      dataSource={localConsoleService}
      errorMessage={localResumeErrorMessage}
      mode="local"
      onLogin={onLogin}
      user={user}
    />
  );
}

function ResumeConsole({
  dataSource,
  errorMessage,
  mode,
  onLogin,
  onLogout,
  user,
}: {
  dataSource: ConsoleDataSource;
  errorMessage: (error: unknown) => string;
  mode: ConsoleMode;
  onLogin?: () => void;
  onLogout?: () => Promise<void>;
  user: ReturnType<typeof useAuthStore.getState>['user'];
}) {
  const navigate = useNavigate();
  const storage = useLocalResumeStatus();
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState<ConsoleQueryState>(INITIAL_QUERY);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [renameResume, setRenameResume] = useState<ConsoleResumeSummary | null>(null);
  const [deleteResume, setDeleteResume] = useState<ConsoleResumeSummary | null>(null);
  const [isLoggingOut, setLoggingOut] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const consoleData = useConsoleData(query, dataSource, errorMessage);
  const isLocal = mode === 'local';
  const isReadOnly = isLocal && storage.availability === 'read-only';
  const isAtLimit = isLocal && consoleData.stats.total >= LOCAL_RESUME_LIMIT;
  const disablesCreation = isReadOnly || isAtLimit;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery((current) =>
        current.query === queryInput ? current : { ...current, page: 1, query: queryInput },
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  function showUnavailable(label: string) {
    setFeedback({ kind: 'info', message: `${label}暂未开放，后续版本会补上哦` });
  }

  function ensureWritable(): boolean {
    if (!isReadOnly) return true;
    setFeedback({
      kind: 'error',
      message: '本地存储暂时不可写；当前只能查看和导出，请先重试连接',
    });
    return false;
  }

  function ensureCapacity(): boolean {
    if (!isAtLimit) return true;
    setFeedback({ kind: 'info', message: `本地最多保存 ${LOCAL_RESUME_LIMIT} 份简历` });
    return false;
  }

  async function handleLogout() {
    if (!onLogout || isLoggingOut) return;
    setLoggingOut(true);
    try {
      await onLogout();
    } catch {
      setFeedback({ kind: 'error', message: '退出登录失败，请稍后重试' });
      setLoggingOut(false);
    }
  }

  async function handleCreate() {
    if (pendingAction || !ensureWritable() || !ensureCapacity()) return;
    setPendingAction('create');
    try {
      const resume = await dataSource.create();
      navigate(editorPath(mode, resume.id));
    } catch (error) {
      setFeedback({ kind: 'error', message: errorMessage(error) });
      setPendingAction(null);
    }
  }

  async function handleCopy(resume: ConsoleResumeSummary) {
    if (!ensureWritable() || !ensureCapacity()) return;
    setPendingAction(`copy:${resume.id}`);
    try {
      await dataSource.copy(resume.id);
      setFeedback({ kind: 'success', message: `已复制“${resume.title}”` });
      consoleData.reload();
    } catch (error) {
      setFeedback({ kind: 'error', message: errorMessage(error) });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRename(resumeId: string, title: string) {
    if (!ensureWritable()) return;
    setPendingAction(`rename:${resumeId}`);
    try {
      const current = consoleData.list.items.find((item) => item.id === resumeId);
      if (!current) throw new Error('resume not found');
      await dataSource.updateTitle(resumeId, current.revision, title);
      setRenameResume(null);
      setFeedback({ kind: 'success', message: '简历名称已更新' });
      consoleData.reload();
    } catch (error) {
      setFeedback({ kind: 'error', message: errorMessage(error) });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete(resume: ConsoleResumeSummary) {
    if (!ensureWritable()) return;
    setPendingAction(`delete:${resume.id}`);
    try {
      await dataSource.delete(resume.id);
      setDeleteResume(null);
      setFeedback({ kind: 'success', message: `已删除“${resume.title}”` });
      if (consoleData.list.items.length === 1 && query.page > 1) {
        setQuery((current) => ({ ...current, page: current.page - 1 }));
      }
      consoleData.reload();
    } catch (error) {
      setFeedback({ kind: 'error', message: errorMessage(error) });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleExport(resume: ConsoleResumeSummary) {
    setPendingAction(`export:${resume.id}`);
    let downloadStarted = false;
    try {
      const blob =
        mode === 'local'
          ? await createLocalResumePdf(resume.id)
          : await resumeEditorService.exportPdf(resume.id);
      downloadBlob(blob, `${resume.title.trim() || 'resume'}.pdf`);
      downloadStarted = true;
      if (mode === 'local' && !isReadOnly) {
        try {
          await localResumeStore.recordExport(resume.id);
        } catch {
          setFeedback({
            kind: 'info',
            message: 'PDF 已开始下载，但导出次数未能保存；本地模式已切换为只读',
          });
          return;
        }
      }
      setFeedback({ kind: 'success', message: `已开始导出“${resume.title}”` });
      consoleData.reload();
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: downloadStarted
          ? 'PDF 已开始下载，但导出记录更新失败'
          : error instanceof UnsupportedResumeContentError
            ? error.message
            : errorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleImport(file: File) {
    if (!ensureWritable() || !ensureCapacity()) return;
    if (file.size > IMPORT_LIMIT_BYTES) {
      setFeedback({ kind: 'error', message: '简历文件不能超过 2 MB' });
      return;
    }
    setPendingAction('import');
    let envelope;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      envelope = parseImportEnvelope(parsed);
    } catch {
      setFeedback({ kind: 'error', message: '文件格式不正确，需要 LittleAgResume v2 JSON 文件' });
      resetImportInput(importInputRef);
      setPendingAction(null);
      return;
    }
    try {
      await dataSource.import(envelope);
      setFeedback({ kind: 'success', message: `已导入“${envelope.title.trim()}”` });
      consoleData.reload();
    } catch (error) {
      setFeedback({ kind: 'error', message: errorMessage(error) });
    } finally {
      setPendingAction(null);
      resetImportInput(importInputRef);
    }
  }

  function updateStatus(status: ConsoleStatusFilter) {
    setQuery((current) => ({ ...current, page: 1, status }));
  }

  function updateSort(sort: ConsoleSort) {
    setQuery((current) => ({ ...current, page: 1, sort }));
  }

  function updatePage(page: number) {
    setQuery((current) => ({ ...current, page }));
    window.requestAnimationFrame(() =>
      gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  function updatePageSize(pageSize: ConsolePageSize) {
    setQuery((current) => ({ ...current, page: 1, pageSize }));
  }

  function resetFilters() {
    setQueryInput('');
    setQuery(INITIAL_QUERY);
  }

  async function retryLocalStorage() {
    try {
      await localResumeStore.retry();
      setFeedback({ kind: 'success', message: '本地存储已恢复' });
      consoleData.reload();
    } catch (error) {
      setFeedback({ kind: 'error', message: errorMessage(error) });
    }
  }

  const hasFilters = query.query.trim() !== '' || query.status !== 'all';
  const ownerInitial =
    mode === 'local' ? 'L' : user?.username.trim().charAt(0).toUpperCase() || 'V';
  const creationDisabledReason = isReadOnly
    ? '本地存储暂时不可写，请先重试连接'
    : isAtLimit
      ? `本地最多保存 ${LOCAL_RESUME_LIMIT} 份简历`
      : undefined;

  return (
    <div className="min-h-screen bg-[#fbfafc] text-[#211725]">
      <ConsoleHeader
        isLoggingOut={isLoggingOut}
        mode={mode}
        onLogin={onLogin}
        onLogout={() => void handleLogout()}
        onPlaceholder={showUnavailable}
        onQueryChange={setQueryInput}
        query={queryInput}
        user={user}
      />
      {feedback ? <FeedbackNotice feedback={feedback} onClose={() => setFeedback(null)} /> : null}
      {isReadOnly ? (
        <div
          className="flex min-h-11 flex-wrap items-center justify-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-2 text-sm font-medium text-amber-900"
          role="alert"
        >
          <AlertTriangle size={16} />
          本地存储暂时不可写，控制台已进入只读恢复；你仍可查看和导出简历。
          <Button
            className="h-8 bg-white"
            onClick={() => void retryLocalStorage()}
            variant="outline"
          >
            <RotateCcw size={15} />
            重试连接
          </Button>
        </div>
      ) : null}

      <main className="mx-auto max-w-[1560px] px-5 py-9 lg:px-10 lg:py-11">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a63a2a]">
              {mode === 'local' ? 'Local workspace' : 'Workspace'}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em] text-[#1f1722] sm:text-4xl">
              我的简历
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#716976] sm:text-base">
              {mode === 'local'
                ? `管理仅保存在当前浏览器中的简历，最多 ${LOCAL_RESUME_LIMIT} 份`
                : '管理你的简历文档，随时编辑与导出'}
            </p>
          </div>
          <Button
            className="h-11 rounded-xl bg-[#bf301e] px-5 text-white shadow-[0_10px_26px_rgba(191,48,30,0.22)] hover:bg-[#9f2718]"
            disabled={pendingAction === 'import' || disablesCreation}
            onClick={() => importInputRef.current?.click()}
            type="button"
          >
            <Upload size={18} />
            {pendingAction === 'import'
              ? '正在导入…'
              : isAtLimit
                ? '已达 20 份上限'
                : '导入已有简历'}
          </Button>
          <input
            ref={importInputRef}
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
            }}
            type="file"
          />
        </section>

        <div className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <ResumeStatsPanel
            error={consoleData.statsError}
            isLoading={consoleData.isStatsLoading}
            stats={consoleData.stats}
          />
          <ResumeToolbar
            onSortChange={updateSort}
            onStatusChange={updateStatus}
            sort={query.sort}
            status={query.status}
          />
        </div>

        <section className="relative mt-7 scroll-mt-28" ref={gridRef}>
          {consoleData.isListRefreshing ? (
            <div className="absolute -top-2 left-0 h-0.5 w-full overflow-hidden rounded-full bg-[#eaddea] before:block before:h-full before:w-1/3 before:animate-[console-progress_1s_ease-in-out_infinite] before:rounded-full before:bg-[#bf301e]" />
          ) : null}
          {consoleData.isListLoading ? <ResumeGridSkeleton /> : null}
          {!consoleData.isListLoading && consoleData.listError ? (
            <ListError message={consoleData.listError} onRetry={consoleData.reload} />
          ) : null}
          {!consoleData.isListLoading && !consoleData.listError ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              <CreateResumeCard
                disabled={disablesCreation}
                disabledReason={creationDisabledReason}
                isPending={pendingAction === 'create'}
                onCreate={() => void handleCreate()}
              />
              {consoleData.list.items.map((resume) => (
                <ResumeCard
                  disableCopy={isAtLimit}
                  disableMutations={isReadOnly}
                  isPending={pendingAction?.endsWith(resume.id) ?? false}
                  key={resume.id}
                  onCopy={() => void handleCopy(resume)}
                  onDelete={() => setDeleteResume(resume)}
                  onExport={() => void handleExport(resume)}
                  onOpen={() => navigate(editorPath(mode, resume.id))}
                  onRename={() => setRenameResume(resume)}
                  ownerInitial={ownerInitial}
                  resume={resume}
                />
              ))}
              {consoleData.list.items.length === 0 ? (
                <EmptyResults hasFilters={hasFilters} onReset={resetFilters} />
              ) : null}
            </div>
          ) : null}
        </section>

        {!consoleData.isListLoading && !consoleData.listError ? (
          <Pagination
            onPageChange={updatePage}
            onPageSizeChange={updatePageSize}
            page={query.page}
            pageSize={query.pageSize}
            total={consoleData.list.total}
          />
        ) : null}
      </main>

      {renameResume ? (
        <RenameResumeDialog
          isPending={pendingAction === `rename:${renameResume.id}`}
          key={renameResume.id}
          onClose={() => setRenameResume(null)}
          onRename={(title) => void handleRename(renameResume.id, title)}
          resume={renameResume}
        />
      ) : null}
      {deleteResume ? (
        <DeleteResumeDialog
          isPending={pendingAction === `delete:${deleteResume.id}`}
          onClose={() => setDeleteResume(null)}
          onDelete={() => void handleDelete(deleteResume)}
          resume={deleteResume}
        />
      ) : null}
    </div>
  );
}

function RenameResumeDialog({
  isPending,
  onClose,
  onRename,
  resume,
}: {
  isPending: boolean;
  onClose: () => void;
  onRename: (title: string) => void;
  resume: ConsoleResumeSummary;
}) {
  const [title, setTitle] = useState(resume.title);
  const normalizedTitle = title.trim();

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
      open
    >
      <DialogContent className="rounded-2xl p-6">
        <DialogTitle>重命名简历</DialogTitle>
        <DialogDescription>名称用于在控制台中识别这份简历，不会修改简历正文。</DialogDescription>
        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (normalizedTitle) onRename(normalizedTitle);
          }}
        >
          <Label className="text-[#433747]" htmlFor="resume-title">
            简历名称
          </Label>
          <Input
            autoFocus
            className="mt-2 focus:border-[#bf301e] focus-visible:ring-[#bf301e]"
            id="resume-title"
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
          <div className="mt-6 flex justify-end gap-3">
            <Button disabled={isPending} onClick={onClose} type="button" variant="outline">
              取消
            </Button>
            <Button
              className="bg-[#bf301e] hover:bg-[#9f2718]"
              disabled={!normalizedTitle || isPending}
              type="submit"
            >
              {isPending ? '保存中…' : '保存名称'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteResumeDialog({
  isPending,
  onClose,
  onDelete,
  resume,
}: {
  isPending: boolean;
  onClose: () => void;
  onDelete: () => void;
  resume: ConsoleResumeSummary;
}) {
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
      open
    >
      <DialogContent className="rounded-2xl p-6">
        <DialogTitle>确认删除“{resume.title}”？</DialogTitle>
        <DialogDescription>删除后无法在控制台恢复，请确认不再需要这份简历。</DialogDescription>
        <div className="mt-6 flex justify-end gap-3">
          <Button disabled={isPending} onClick={onClose} type="button" variant="outline">
            取消
          </Button>
          <Button disabled={isPending} onClick={onDelete} type="button" variant="destructive">
            {isPending ? '删除中…' : '确认删除'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConsoleMessage({ children }: { children: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fbfafc] px-6 text-center text-[#746b78]">
      {children}
    </main>
  );
}

function LocalStorageFailure({
  error,
  onClear,
  onRetry,
}: {
  error: string | null;
  onClear: () => void;
  onRetry: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fbfafc] px-6 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-[0_24px_70px_rgba(76,45,32,0.1)]">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-50 text-amber-700">
          <HardDrive size={30} />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-[#2b202e]">无法打开本地简历</h1>
        <p className="mt-3 text-sm leading-7 text-[#766c79]">
          {error ?? '浏览器本地存储暂时不可用。我们没有创建空数据，也没有覆盖原有简历。'}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={onRetry}>
            <RotateCcw size={16} />
            重试连接
          </Button>
          <Button onClick={onClear} variant="destructive">
            <Trash2 size={16} />
            清除本地数据
          </Button>
        </div>
      </section>
    </main>
  );
}

async function createLocalResumePdf(resumeId: string): Promise<Blob> {
  const { avatar, document } = await localResumeStore.get(resumeId);
  const avatarUrl = avatar ? URL.createObjectURL(avatar) : null;
  try {
    const { createResumePdfBlob } =
      await import('@/pages/resume-editor/service/resume-pdf.service');
    return await createResumePdfBlob(document, avatarUrl);
  } finally {
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
  }
}

function editorPath(mode: ConsoleMode, resumeId: string): string {
  return mode === 'local' ? `/local/resumes/${resumeId}/edit` : `/resumes/${resumeId}/edit`;
}

function localResumeErrorMessage(error: unknown): string {
  if (error instanceof LocalResumeLimitError) return error.message;
  if (error instanceof LocalResumeStorageError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return '本地简历操作失败，请稍后重试';
}

function downloadBlob(blob: Blob, filename: string): void {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

function resetImportInput(input: { current: HTMLInputElement | null }): void {
  if (input.current) input.current.value = '';
}
