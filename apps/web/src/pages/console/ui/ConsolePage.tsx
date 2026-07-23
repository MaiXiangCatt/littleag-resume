import { Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { normalizeContent, parseImportEnvelope } from '@/pages/resume-editor/model/resume.model';
import { resumeEditorService } from '@/pages/resume-editor/service/resume-editor.service';
import type { ResumeSummary } from '@/shared/api/generated/model/resumeSummary';
import type { ResumeSort } from '@/shared/api/generated/model/resumeSort';
import { useAuthStore } from '@/shared/auth/store/auth.store';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

import { resumeErrorMessage, resumeService } from '../service/resume.service';
import type {
  ConsolePageSize,
  ConsoleQueryState,
  ConsoleStatusFilter,
  Feedback,
} from '../model/console.types';
import { useConsoleData } from '../hooks/useConsoleData';
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

type ConsolePageProps = {
  onLogout?: () => Promise<void>;
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
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbfafc] text-[#746b78]">
        正在加载账号信息
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbfafc] px-6 text-center text-[#746b78]">
        {authError ?? '暂时无法恢复登录状态，请刷新重试'}
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbfafc] text-[#746b78]">
        请先登录
      </main>
    );
  }

  return <AuthenticatedConsole onLogout={onLogout} user={user} />;
}

function AuthenticatedConsole({
  onLogout,
  user,
}: {
  onLogout?: () => Promise<void>;
  user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
}) {
  const navigate = useNavigate();
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState<ConsoleQueryState>(INITIAL_QUERY);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [renameResume, setRenameResume] = useState<ResumeSummary | null>(null);
  const [deleteResume, setDeleteResume] = useState<ResumeSummary | null>(null);
  const [isLoggingOut, setLoggingOut] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const consoleData = useConsoleData(query);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery((current) =>
        current.query === queryInput ? current : { ...current, page: 1, query: queryInput },
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timer = window.setTimeout(() => setFeedback(null), 4200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  function showUnavailable(label: string) {
    setFeedback({ kind: 'info', message: `${label}暂未开放，后续版本会补上哦` });
  }

  async function handleLogout() {
    if (!onLogout || isLoggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      await onLogout();
    } catch {
      setFeedback({ kind: 'error', message: '退出登录失败，请稍后重试' });
      setLoggingOut(false);
    }
  }

  async function handleCreate() {
    if (pendingAction) {
      return;
    }
    setPendingAction('create');
    try {
      const resume = await resumeService.create();
      navigate(`/resumes/${resume.id}/edit`);
    } catch (error) {
      setFeedback({ kind: 'error', message: resumeErrorMessage(error) });
      setPendingAction(null);
    }
  }

  async function handleCopy(resume: ResumeSummary) {
    setPendingAction(`copy:${resume.id}`);
    try {
      await resumeService.copy(resume.id);
      setFeedback({ kind: 'success', message: `已复制“${resume.title}”` });
      consoleData.reload();
    } catch (error) {
      setFeedback({ kind: 'error', message: resumeErrorMessage(error) });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRename(resumeId: string, title: string) {
    setPendingAction(`rename:${resumeId}`);
    try {
      const current = consoleData.list.items.find((item) => item.id === resumeId);
      if (!current) throw new Error('resume not found');
      await resumeService.update(resumeId, { expectedRevision: current.revision, title });
      setRenameResume(null);
      setFeedback({ kind: 'success', message: '简历名称已更新' });
      consoleData.reload();
    } catch (error) {
      setFeedback({ kind: 'error', message: resumeErrorMessage(error) });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete(resume: ResumeSummary) {
    setPendingAction(`delete:${resume.id}`);
    try {
      await resumeService.delete(resume.id);
      setDeleteResume(null);
      setFeedback({ kind: 'success', message: `已删除“${resume.title}”` });
      if (consoleData.list.items.length === 1 && query.page > 1) {
        setQuery((current) => ({ ...current, page: current.page - 1 }));
      }
      consoleData.reload();
    } catch (error) {
      setFeedback({ kind: 'error', message: resumeErrorMessage(error) });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleExport(resume: ResumeSummary) {
    setPendingAction(`export:${resume.id}`);
    let avatarUrl: string | null = null;
    try {
      const detail = await resumeEditorService.get(resume.id);
      if (detail.hasAvatar) {
        avatarUrl = URL.createObjectURL(await resumeEditorService.getAvatar(resume.id));
      }
      const { createResumePdfBlob } =
        await import('@/pages/resume-editor/service/resume-pdf.service');
      const blob = await createResumePdfBlob(
        { ...detail, content: normalizeContent(detail.content) },
        avatarUrl,
      );
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `${detail.title.trim() || 'resume'}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      await resumeEditorService.recordExport(resume.id);
      setFeedback({ kind: 'success', message: `已开始导出“${resume.title}”` });
      consoleData.reload();
    } catch (error) {
      setFeedback({ kind: 'error', message: resumeErrorMessage(error) });
    } finally {
      if (avatarUrl) URL.revokeObjectURL(avatarUrl);
      setPendingAction(null);
    }
  }

  async function handleImport(file: File) {
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
      setFeedback({ kind: 'error', message: '文件格式不正确，需要 VegaResume v1 JSON 文件' });
      setPendingAction(null);
      if (importInputRef.current) importInputRef.current.value = '';
      return;
    }
    try {
      await resumeService.import(envelope);
      setFeedback({ kind: 'success', message: `已导入“${envelope.title.trim()}”` });
      consoleData.reload();
    } catch (error) {
      setFeedback({ kind: 'error', message: resumeErrorMessage(error) });
    } finally {
      setPendingAction(null);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  }

  function updateStatus(statusFilter: ConsoleStatusFilter) {
    setQuery((current) => ({ ...current, page: 1, status: statusFilter }));
  }

  function updateSort(sort: ResumeSort) {
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

  const hasFilters = query.query.trim() !== '' || query.status !== 'all';
  const ownerInitial = user.username.trim().charAt(0).toUpperCase() || 'V';

  return (
    <div className="min-h-screen bg-[#fbfafc] text-[#211725]">
      <ConsoleHeader
        isLoggingOut={isLoggingOut}
        onLogout={handleLogout}
        onPlaceholder={showUnavailable}
        onQueryChange={setQueryInput}
        query={queryInput}
        user={user}
      />
      {feedback ? <FeedbackNotice feedback={feedback} onClose={() => setFeedback(null)} /> : null}

      <main className="mx-auto max-w-[1560px] px-5 py-9 lg:px-10 lg:py-11">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b4c91]">
              Workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em] text-[#1f1722] sm:text-4xl">
              我的简历
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#716976] sm:text-base">
              管理你的简历文档，随时编辑与导出
            </p>
          </div>
          <Button
            className="h-11 rounded-xl bg-[#850477] px-5 text-white shadow-[0_10px_26px_rgba(133,4,119,0.22)] hover:bg-[#6f0364]"
            disabled={pendingAction === 'import'}
            onClick={() => importInputRef.current?.click()}
            type="button"
          >
            <Upload size={18} />
            {pendingAction === 'import' ? '正在导入…' : '导入已有简历'}
          </Button>
          <input
            ref={importInputRef}
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleImport(file);
              }
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
            <div className="absolute -top-2 left-0 h-0.5 w-full overflow-hidden rounded-full bg-[#eaddea] before:block before:h-full before:w-1/3 before:animate-[console-progress_1s_ease-in-out_infinite] before:rounded-full before:bg-[#850477]" />
          ) : null}
          {consoleData.isListLoading ? <ResumeGridSkeleton /> : null}
          {!consoleData.isListLoading && consoleData.listError ? (
            <ListError message={consoleData.listError} onRetry={consoleData.reload} />
          ) : null}
          {!consoleData.isListLoading && !consoleData.listError ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              <CreateResumeCard
                isPending={pendingAction === 'create'}
                onCreate={() => void handleCreate()}
              />
              {consoleData.list.items.map((resume) => (
                <ResumeCard
                  isPending={pendingAction?.endsWith(resume.id) ?? false}
                  key={resume.id}
                  onCopy={() => void handleCopy(resume)}
                  onDelete={() => setDeleteResume(resume)}
                  onExport={() => void handleExport(resume)}
                  onOpen={() => navigate(`/resumes/${resume.id}/edit`)}
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
  resume: ResumeSummary;
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
            if (normalizedTitle) {
              onRename(normalizedTitle);
            }
          }}
        >
          <Label className="text-[#433747]" htmlFor="resume-title">
            简历名称
          </Label>
          <Input
            autoFocus
            className="mt-2 focus:border-[#850477] focus-visible:ring-[#850477]"
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
              className="bg-[#850477] hover:bg-[#6f0364]"
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
  resume: ResumeSummary;
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
