import {
  ArrowDownAZ,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Ellipsis,
  FilePlus2,
  FileText,
  LoaderCircle,
  Pencil,
  PenLine,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ComponentType } from 'react';

import type { ResumeStats } from '@/shared/api/generated/model/resumeStats';
import type { ResumeSummary } from '@/shared/api/generated/model/resumeSummary';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Label } from '@/shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';

import type {
  ConsolePageSize,
  ConsoleSort,
  ConsoleStatusFilter,
  Feedback,
} from '../../model/console.types';

type StatItem = {
  icon: ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  key: keyof ResumeStats;
  label: string;
  unit: string;
};

const STAT_ITEMS: StatItem[] = [
  { icon: FileText, key: 'total', label: '简历总数', unit: '份' },
  { icon: PenLine, key: 'draft', label: '草稿', unit: '份' },
  { icon: CheckCircle2, key: 'completed', label: '已完成', unit: '份' },
  { icon: Upload, key: 'exported', label: '已导出', unit: '次' },
];

export function FeedbackNotice({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) {
  return (
    <div
      aria-live="polite"
      className={cn(
        'fixed left-1/2 top-24 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-[0_14px_42px_rgba(43,29,46,0.16)]',
        feedback.kind === 'error' ? 'border-red-200 text-red-700' : 'border-[#dfd3df] text-[#5e2358]',
      )}
    >
      <span>{feedback.message}</span>
      <Button variant="ghost" className="h-auto p-0 font-semibold opacity-65 hover:bg-transparent hover:opacity-100" onClick={onClose}>
        关闭
      </Button>
    </div>
  );
}

export function ResumeStatsPanel({
  error,
  isLoading,
  stats,
}: {
  error: string | null;
  isLoading: boolean;
  stats: ResumeStats;
}) {
  if (error) {
    return (
      <section className="flex min-h-28 items-center justify-center rounded-2xl border border-red-100 bg-white px-5 text-sm text-red-600">
        统计数据暂时无法加载
      </section>
    );
  }

  return (
    <section aria-label="简历统计" className="grid min-h-28 grid-cols-2 rounded-2xl border border-[#ebe6ed] bg-white px-2 py-4 shadow-[0_8px_30px_rgba(57,39,61,0.035)] xl:grid-cols-4">
      {STAT_ITEMS.map(({ icon: Icon, key, label, unit }, index) => (
        <div
          className={cn(
            'flex min-w-0 items-center gap-3 px-3 py-2 sm:px-5',
            index % 2 === 1 ? 'border-l border-[#eee9f0]' : '',
            index > 1 ? 'border-t border-[#eee9f0] xl:border-t-0' : '',
            index > 0 ? 'xl:border-l xl:border-[#eee9f0]' : '',
          )}
          key={key}
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f7eef7] text-[#850477]">
            <Icon aria-hidden="true" size={22} strokeWidth={1.7} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm text-[#6d6571]">{label}</span>
            <span className="mt-0.5 flex items-baseline gap-1">
              <span className={cn('text-2xl font-semibold tracking-[-0.04em] text-[#211725]', isLoading ? 'animate-pulse text-[#d9d2dc]' : '')}>
                {isLoading ? '—' : stats[key]}
              </span>
              <span className="text-xs text-[#817985]">{unit}</span>
            </span>
          </span>
        </div>
      ))}
    </section>
  );
}

const FILTERS: Array<{ label: string; value: ConsoleStatusFilter }> = [
  { label: '全部', value: 'all' },
  { label: '已完成', value: 'completed' },
  { label: '草稿', value: 'draft' },
];

export function ResumeToolbar({
  onSortChange,
  onStatusChange,
  sort,
  status,
}: {
  onSortChange: (sort: ConsoleSort) => void;
  onStatusChange: (status: ConsoleStatusFilter) => void;
  sort: ConsoleSort;
  status: ConsoleStatusFilter;
}) {
  return (
    <section className="flex min-h-28 flex-col justify-center gap-4 rounded-2xl border border-[#ebe6ed] bg-white px-4 py-5 shadow-[0_8px_30px_rgba(57,39,61,0.035)] sm:flex-row sm:items-center sm:justify-between">
      <div aria-label="按状态筛选" className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:pb-0">
        {FILTERS.map((filter) => (
          <Button
            aria-pressed={status === filter.value}
            variant="ghost"
            className={cn(
              'h-auto shrink-0 rounded-full border px-5 py-2 text-sm font-medium transition',
              status === filter.value
                ? 'border-[#850477] bg-[#850477] text-white shadow-[0_7px_18px_rgba(133,4,119,0.2)] hover:bg-[#850477] hover:text-white'
                : 'border-[#e7e1e9] bg-white text-[#635b67] hover:border-[#cba7c7] hover:bg-white hover:text-[#850477]',
            )}
            key={filter.value}
            onClick={() => onStatusChange(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>
      <div className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[#dfd9e2] bg-white px-3 text-sm text-[#5e5662]">
        <ArrowDownAZ aria-hidden="true" size={18} />
        <Label className="text-sm text-[#5e5662]">排序</Label>
        <Select onValueChange={(value) => onSortChange(value as ConsoleSort)} value={sort}>
          <SelectTrigger aria-label="简历排序" className="h-auto w-auto border-0 bg-transparent px-1 py-0 font-medium text-[#332936] shadow-none focus-visible:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_desc">最近更新</SelectItem>
            <SelectItem value="updated_asc">最早更新</SelectItem>
            <SelectItem value="created_desc">最新创建</SelectItem>
            <SelectItem value="title_asc">名称升序</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}

export function CreateResumeCard({ isPending, onCreate }: { isPending: boolean; onCreate: () => void }) {
  return (
    <Button
      variant="ghost"
      className="group h-auto min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[#a63498] bg-[radial-gradient(circle_at_50%_20%,rgba(176,56,158,0.08),transparent_52%)] px-8 text-center transition duration-300 hover:-translate-y-1 hover:border-[#850477] hover:bg-[radial-gradient(circle_at_50%_20%,rgba(176,56,158,0.08),transparent_52%)] hover:shadow-[0_18px_38px_rgba(97,32,89,0.11)] focus-visible:ring-4 focus-visible:ring-[#850477]/15 disabled:pointer-events-none disabled:opacity-60"
      disabled={isPending}
      onClick={onCreate}
    >
      <span className="grid size-14 place-items-center rounded-full bg-[#850477] text-white shadow-[0_10px_24px_rgba(133,4,119,0.28)] transition group-hover:scale-105">
        {isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={25} /> : <Plus aria-hidden="true" size={30} strokeWidth={1.8} />}
      </span>
      <span className="mt-5 text-lg font-semibold text-[#7d176f]">{isPending ? '正在创建…' : '创建新简历'}</span>
      <span className="mt-2 max-w-72 text-sm leading-6 text-[#817684]">从空白模板开始，快速创建你的专属简历</span>
    </Button>
  );
}

type ResumeCardProps = {
  isPending: boolean;
  onCopy: () => void;
  onDelete: () => void;
  onExport: () => void;
  onOpen: () => void;
  onRename: () => void;
  ownerInitial: string;
  resume: ResumeSummary;
};

export function ResumeCard({
  isPending,
  onCopy,
  onDelete,
  onExport,
  onOpen,
  onRename,
  ownerInitial,
  resume,
}: ResumeCardProps) {
  const isCompleted = resume.status === 'completed';

  return (
    <article className="resume-card group relative grid min-h-56 grid-cols-[38%_1fr] gap-5 overflow-visible rounded-2xl border border-[#e8e3ea] bg-white p-4 shadow-[0_8px_25px_rgba(50,34,53,0.055)] transition duration-300 hover:-translate-y-1 hover:border-[#dbcddd] hover:shadow-[0_20px_44px_rgba(63,37,65,0.11)] sm:p-5">
      <Button
        aria-label={`编辑 ${resume.title}`}
        variant="ghost"
        className="relative h-auto min-h-48 w-full overflow-hidden rounded-xl border border-[#e5e0e7] bg-[#faf9fb] p-0 text-left hover:bg-[#faf9fb] focus-visible:ring-3 focus-visible:ring-[#850477]/25"
        onClick={onOpen}
      >
        <ResumePlaceholder initial={ownerInitial} />
      </Button>

      <div className="flex min-w-0 flex-col py-1">
        <div className="flex items-start gap-2">
          <Button variant="ghost" className="h-auto min-w-0 p-0 text-left hover:bg-transparent" onClick={onOpen}>
            <h2 className="truncate text-lg font-semibold tracking-[-0.025em] text-[#241a27] transition hover:text-[#850477]">{resume.title}</h2>
          </Button>
          <span
            className={cn(
              'mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
              isCompleted ? 'bg-[#f5e9f4] text-[#8a197d]' : 'bg-[#fbf1ff] text-[#9344a2]',
            )}
          >
            {isCompleted ? '已完成' : '草稿'}
          </span>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-[#867d89]">
          <Clock3 aria-hidden="true" size={14} />
          最近编辑：{formatRelativeTime(resume.updatedAt)}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          <Button
            aria-label={`导出 ${resume.title} PDF`}
            className="border-[#d6a7d1] text-[#850477]"
            disabled={isPending}
            onClick={onExport}
            size="sm"
            variant="outline"
          >
            {isPending ? <LoaderCircle className="animate-spin" size={16} /> : <Download size={16} />}
            {isPending ? '生成中…' : '导出 PDF'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`${resume.title} 更多操作`}
                variant="outline"
                size="icon"
                className="size-8 rounded-lg border-[#ded8e1] text-[#564e59] hover:border-[#ba82b3] hover:text-[#850477]"
              >
                <Ellipsis size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 rounded-xl border-[#e8e2ea] p-1.5 shadow-[0_14px_34px_rgba(48,31,51,0.16)]">
              <DropdownMenuItem className="gap-2 rounded-lg px-3 py-2 text-sm text-[#514955] focus:bg-[#f8f2f8] focus:text-[#850477]" onClick={onRename}>
                <Pencil size={15} />重命名
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 rounded-lg px-3 py-2 text-sm text-[#514955] focus:bg-[#f8f2f8] focus:text-[#850477]" onClick={onCopy}>
                <Copy size={15} />复制简历
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#f0ecf1] pt-3">
          <Button variant="ghost" className="h-auto gap-2 p-0 text-sm text-[#625966] hover:bg-transparent hover:text-[#850477]" onClick={onOpen}>
            <Pencil aria-hidden="true" size={16} />编辑
          </Button>
          <Button variant="ghost" className="h-auto gap-2 p-0 text-sm text-[#625966] hover:bg-transparent hover:text-red-600" onClick={onDelete}>
            <Trash2 aria-hidden="true" size={16} />删除
          </Button>
        </div>
      </div>
      {isPending ? (
        <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-white/75 backdrop-blur-[1px]">
          <LoaderCircle aria-label="正在处理" className="animate-spin text-[#850477]" size={28} />
        </div>
      ) : null}
    </article>
  );
}

function ResumePlaceholder({ initial }: { initial: string }) {
  return (
    <span className="absolute inset-0 flex flex-col bg-white p-3 text-[#48394b]">
      <span className="flex items-start justify-between border-b border-[#eaddea] pb-2">
        <span>
          <span className="block text-[7px] font-bold tracking-[0.16em] text-[#850477]">VEGA RESUME</span>
          <span className="mt-1 block h-1.5 w-12 rounded-full bg-[#d7c2d5]" />
        </span>
        <span className="grid size-7 place-items-center rounded-full bg-[#eee3ed] text-[10px] font-bold text-[#850477]">{initial}</span>
      </span>
      <span className="mt-3 grid gap-2">
        <span className="h-1.5 w-2/3 rounded-full bg-[#3e3041]/80" />
        <span className="h-1 w-full rounded-full bg-[#e2dce4]" />
        <span className="h-1 w-5/6 rounded-full bg-[#e2dce4]" />
      </span>
      <span className="mt-3 block text-[6px] font-bold tracking-widest text-[#8c2581]">EXPERIENCE</span>
      <span className="mt-2 grid gap-1.5">
        <span className="h-1 w-full rounded-full bg-[#ded7e0]" />
        <span className="h-1 w-11/12 rounded-full bg-[#e7e2e8]" />
        <span className="h-1 w-4/5 rounded-full bg-[#e7e2e8]" />
        <span className="h-1 w-full rounded-full bg-[#ded7e0]" />
        <span className="h-1 w-3/4 rounded-full bg-[#e7e2e8]" />
      </span>
      <span className="mt-auto grid grid-cols-4 gap-1">
        <span className="h-1 rounded-full bg-[#b867ad]" />
        <span className="h-1 rounded-full bg-[#d7afd2]" />
        <span className="h-1 rounded-full bg-[#b867ad]" />
        <span className="h-1 rounded-full bg-[#d7afd2]" />
      </span>
    </span>
  );
}

export function ResumeGridSkeleton() {
  return (
    <div aria-label="正在加载简历" className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
      <div className="min-h-56 animate-pulse rounded-2xl border border-dashed border-[#d8ceda] bg-[#f8f5f8]" />
      {[0, 1, 2, 3, 4].map((item) => (
        <div className="grid min-h-56 animate-pulse grid-cols-[38%_1fr] gap-5 rounded-2xl border border-[#eee9ef] bg-white p-5" key={item}>
          <div className="rounded-xl bg-[#f0edf1]" />
          <div className="py-3">
            <div className="h-5 w-4/5 rounded-full bg-[#ece8ed]" />
            <div className="mt-4 h-3 w-3/5 rounded-full bg-[#f0edf1]" />
            <div className="mt-16 h-8 w-4/5 rounded-lg bg-[#eee9ef]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyResults({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return (
    <div className="col-span-full flex min-h-64 flex-col items-center justify-center rounded-2xl border border-[#e8e3ea] bg-white px-6 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-[#f6eef6] text-[#850477]">
        {hasFilters ? <RotateCcw size={24} /> : <FilePlus2 size={24} />}
      </span>
      <h2 className="mt-4 text-lg font-semibold text-[#2b202e]">{hasFilters ? '没有找到符合条件的简历' : '从第一份简历开始吧'}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#7c737f]">
        {hasFilters ? '换个关键词或清除筛选条件，再试一次。' : '点击上方的创建卡片，新建一份可以持续编辑的简历。'}
      </p>
      {hasFilters ? (
        <Button className="mt-5 border-[#d5b4d1] text-[#850477]" onClick={onReset} variant="outline">
          清除筛选
        </Button>
      ) : null}
    </div>
  );
}

export function ListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-red-100 bg-white px-6 text-center">
      <p className="text-sm text-red-600">{message}</p>
      <Button className="mt-4" onClick={onRetry} variant="outline">
        <RotateCcw size={16} />重新加载
      </Button>
    </div>
  );
}

export function Pagination({
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  total,
}: {
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: ConsolePageSize) => void;
  page: number;
  pageSize: ConsolePageSize;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize && page === 1) {
    return null;
  }
  const pages = paginationWindow(page, totalPages);

  return (
    <nav aria-label="简历分页" className="mt-8 flex flex-col items-center justify-between gap-5 sm:flex-row">
      <span className="hidden text-sm text-[#817985] sm:block">共 {total} 份简历</span>
      <div className="flex items-center gap-2">
        <Button aria-label="上一页" disabled={page <= 1} onClick={() => onPageChange(page - 1)} size="icon" variant="outline">
          <ChevronLeft size={17} />
        </Button>
        {pages.map((pageNumber) => (
          <Button
            aria-current={pageNumber === page ? 'page' : undefined}
            variant="ghost"
            size="icon"
            className={cn(
              'size-9 rounded-lg text-sm font-semibold',
              pageNumber === page
                ? 'bg-[#850477] text-white shadow-[0_7px_18px_rgba(133,4,119,0.2)] hover:bg-[#850477] hover:text-white'
                : 'text-[#514955] hover:bg-[#f5edf5]',
            )}
            key={pageNumber}
            onClick={() => onPageChange(pageNumber)}
          >
            {pageNumber}
          </Button>
        ))}
        <Button aria-label="下一页" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} size="icon" variant="outline">
          <ChevronRight size={17} />
        </Button>
      </div>
      <div className="flex items-center gap-2 text-sm text-[#716976]">
        <Label className="text-sm font-normal leading-normal text-[#716976]">每页显示</Label>
        <Select onValueChange={(value) => onPageSizeChange(Number(value) as ConsolePageSize)} value={String(pageSize)}>
          <SelectTrigger aria-label="每页显示数量" className="h-10 w-auto rounded-lg border-[#ded8e1] bg-white px-3 font-semibold text-[#332936] focus-visible:border-[#850477]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6">6</SelectItem>
            <SelectItem value="12">12</SelectItem>
            <SelectItem value="24">24</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </nav>
  );
}

function paginationWindow(page: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const start = Math.min(Math.max(1, page - 2), totalPages - 4);
  return Array.from({ length: 5 }, (_, index) => start + index);
}

const relativeFormatter = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });

function formatRelativeTime(value: string) {
  const elapsed = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(elapsed)) {
    return '刚刚';
  }
  const absolute = Math.abs(elapsed);
  if (absolute < 60_000) {
    return '刚刚';
  }
  if (absolute < 3_600_000) {
    return relativeFormatter.format(Math.round(elapsed / 60_000), 'minute');
  }
  if (absolute < 86_400_000) {
    return relativeFormatter.format(Math.round(elapsed / 3_600_000), 'hour');
  }
  return relativeFormatter.format(Math.round(elapsed / 86_400_000), 'day');
}
