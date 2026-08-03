import { BarChart3, Check, RotateCcw, ShieldCheck } from 'lucide-react';
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
        className="w-[min(92vw,500px)] overflow-hidden rounded-[28px] border border-[#eadbd7] bg-[#fffdfc] p-0 shadow-[0_30px_100px_rgba(70,28,21,0.24)]"
        onEscapeKeyDown={(event) => {
          if (isPrompt) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (isPrompt) event.preventDefault();
        }}
        showCloseButton={!isPrompt}
      >
        <div className="relative overflow-hidden border-b border-[#ecdeda] bg-[#351d19] px-7 pb-7 pt-8 text-[#fff8f5]">
          <div className="absolute -right-12 -top-16 size-48 rounded-full border-[28px] border-[#bf301e]/45" />
          <div className="absolute -bottom-20 right-20 size-40 rounded-full border-[22px] border-[#f1b4a8]/10" />
          <span className="relative grid size-12 place-items-center rounded-2xl bg-[#bf301e] shadow-[0_12px_30px_rgba(191,48,30,0.35)]">
            <ShieldCheck aria-hidden="true" size={24} />
          </span>
          <DialogTitle className="relative mt-5 font-serif text-2xl text-white">
            {isPrompt ? '帮我们了解功能是否真的有用' : '匿名统计与隐私'}
          </DialogTitle>
          <DialogDescription className="relative mt-2 max-w-md leading-6 text-[#ead5d0]">
            只记录创建、导入和导出是否成功，不读取简历内容，也不会和你的账号关联。
          </DialogDescription>
        </div>

        <div className="px-7 py-6">
          <div className="grid gap-3 text-sm text-[#5f5055] sm:grid-cols-2">
            <div className="rounded-2xl border border-[#eee4e1] bg-white p-4">
              <BarChart3 aria-hidden="true" className="text-[#bf301e]" size={19} />
              <p className="mt-3 font-semibold text-[#2f2327]">我们会记录</p>
              <p className="mt-1 leading-6">匿名安装标识、功能里程碑、模式与时间。</p>
            </div>
            <div className="rounded-2xl border border-[#eee4e1] bg-white p-4">
              <Check aria-hidden="true" className="text-[#bf301e]" size={19} />
              <p className="mt-3 font-semibold text-[#2f2327]">我们不会记录</p>
              <p className="mt-1 leading-6">姓名、邮箱、IP、设备信息或任何简历字段。</p>
            </div>
          </div>

          {choice ? (
            <p className="mt-5 rounded-xl bg-[#f7f0ee] px-4 py-3 text-sm text-[#5d4946]">
              当前状态：
              <span className="ml-1 font-semibold text-[#a12b1c]">
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

          <p className="mt-5 text-xs leading-5 text-[#84777b]">
            你可以随时修改选择；撤回后会删除与该匿名安装标识关联的事件明细。无标识的汇总计数不会回滚。
            <Link className="ml-1 text-[#9f2718]" href="/legal/privacy" target="_blank">
              查看隐私政策
            </Link>
          </p>

          <DialogFooter className="mt-6 flex-col-reverse gap-3 sm:flex-row">
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
                className="w-full bg-[#bf301e] shadow-[0_8px_22px_rgba(191,48,30,0.2)] hover:bg-[#9f2718] sm:w-auto"
                disabled={isSaving || deletionError}
                onClick={() => void choose('granted')}
              >
                {isSaving ? '正在保存…' : '同意匿名统计'}
              </Button>
            ) : null}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
