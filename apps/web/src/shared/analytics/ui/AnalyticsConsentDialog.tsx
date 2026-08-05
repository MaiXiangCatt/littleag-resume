import { Check, RotateCcw, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { isAnalyticsExcludedPath, isAnalyticsInteractivePath } from '../model/analytics';
import { useAnalyticsStore } from '../store/analytics.store';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Link } from '@/shared/ui/link';

export function AnalyticsConsentController() {
  const location = useLocation();
  const bootstrap = useAnalyticsStore((state) => state.bootstrap);
  const dialogMode = useAnalyticsStore((state) => state.dialogMode);
  const excluded = isAnalyticsExcludedPath(location.pathname);

  useEffect(() => {
    if (!excluded) void bootstrap();
  }, [bootstrap, excluded]);

  if (excluded) return null;
  if (dialogMode === 'prompt' && !isAnalyticsInteractivePath(location.pathname)) return null;
  return <AnalyticsConsentDialog />;
}

function AnalyticsConsentDialog() {
  const choice = useAnalyticsStore((state) => state.choice);
  const choose = useAnalyticsStore((state) => state.choose);
  const closeSettings = useAnalyticsStore((state) => state.closeSettings);
  const deletionError = useAnalyticsStore((state) => state.deletionError);
  const dialogMode = useAnalyticsStore((state) => state.dialogMode);
  const isSaving = useAnalyticsStore((state) => state.isSaving);
  const retryDeletion = useAnalyticsStore((state) => state.retryDeletion);
  const storageAvailable = useAnalyticsStore((state) => state.storageAvailable);
  const withdraw = useAnalyticsStore((state) => state.withdraw);
  const isPrompt = dialogMode === 'prompt';

  if (!dialogMode || !storageAvailable) return null;

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && !isPrompt) closeSettings();
      }}
      open
    >
      <DialogContent
        className="w-[min(calc(100vw-2rem),440px)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl"
        onEscapeKeyDown={(event) => {
          if (isPrompt) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (isPrompt) event.preventDefault();
        }}
        overlayClassName="bg-slate-950/35 backdrop-blur-[1px]"
        showCloseButton={!isPrompt}
      >
        <div className="flex items-start gap-3 px-6 pb-4 pt-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck aria-hidden="true" size={21} />
          </span>
          <div className="min-w-0 pr-4">
            <DialogTitle className="text-lg font-semibold text-slate-950">
              {isPrompt ? '匿名使用统计' : '匿名统计设置'}
            </DialogTitle>
            <DialogDescription className="mt-1.5 leading-6 text-slate-600">
              是否允许我们收集少量匿名使用数据，帮助改进功能体验？
            </DialogDescription>
          </div>
        </div>

        <div className="px-6 pb-5">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <div className="flex items-start gap-3">
              <Check aria-hidden="true" className="mt-1 shrink-0 text-primary" size={17} />
              <p>
                <span className="font-medium text-slate-900">会记录：</span>
                随机匿名安装标识、创建/导入/导出是否成功、使用模式与时间。
              </p>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck aria-hidden="true" className="mt-1 shrink-0 text-primary" size={17} />
              <p>
                <span className="font-medium text-slate-900">不会记录：</span>
                姓名、邮箱、IP、设备信息或任何简历内容，也不会与账号关联。
              </p>
            </div>
          </div>

          {choice ? (
            <p className="mt-4 rounded-lg bg-primary/5 px-3.5 py-2.5 text-sm text-slate-600">
              当前状态：
              <span className="ml-1 font-medium text-primary">
                {choice === 'granted' ? '已参与匿名统计' : '未参与匿名统计'}
              </span>
            </p>
          ) : null}
          {deletionError ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p>历史明细暂未删除成功。我们已经停止上报，你可以现在重试，也可以稍后再来。</p>
              <Button
                className="mt-3 bg-white"
                disabled={isSaving}
                onClick={() => void retryDeletion()}
                size="sm"
                variant="outline"
              >
                <RotateCcw aria-hidden="true" size={15} />
                重试删除
              </Button>
            </div>
          ) : null}

          <p className="mt-4 text-xs leading-5 text-slate-500">
            你可以随时修改选择；撤回后会删除与该匿名安装标识关联的事件明细。无标识的汇总计数不会回滚。
            <Link
              className="ml-1 text-primary hover:underline"
              href="/legal/privacy"
              target="_blank"
            >
              查看隐私政策
            </Link>
          </p>
        </div>

        <DialogFooter className="mt-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row">
          {choice === 'granted' && !isPrompt ? (
            <Button
              className="w-full sm:w-auto"
              disabled={isSaving}
              onClick={() => void withdraw()}
              variant="outline"
            >
              {isSaving ? '正在处理…' : '退出匿名统计'}
            </Button>
          ) : (
            <Button
              className="w-full sm:w-auto"
              disabled={isSaving}
              onClick={() => void choose('denied')}
              variant="outline"
            >
              暂不参与
            </Button>
          )}
          {choice !== 'granted' ? (
            <Button
              className="w-full sm:min-w-32 sm:w-auto"
              disabled={isSaving || deletionError}
              onClick={() => void choose('granted')}
            >
              {isSaving ? '正在保存…' : '同意匿名统计'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
