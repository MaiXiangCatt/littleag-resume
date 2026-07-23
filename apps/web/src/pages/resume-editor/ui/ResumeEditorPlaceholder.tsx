import { ArrowLeft, Construction, FileText } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/shared/ui/button';

export function ResumeEditorPlaceholder() {
  const navigate = useNavigate();
  const { resumeId } = useParams<{ resumeId: string }>();

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_20%,rgba(133,4,119,0.08),transparent_42%),#fbfafc] px-6">
      <section className="w-full max-w-xl rounded-3xl border border-[#e7dfe8] bg-white p-8 text-center shadow-[0_24px_70px_rgba(65,37,67,0.1)] sm:p-12">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#f4e9f3] text-[#850477]">
          <Construction aria-hidden="true" size={30} strokeWidth={1.7} />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#a04a95]">
          Resume editor
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em] text-[#211725]">
          编辑器正在准备中
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#756c79]">
          简历已经创建并安全保存。内容编辑、实时预览与 PDF 导出会在编辑器阶段接入。
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-[#faf7fa] px-4 py-3 text-xs text-[#857c89]">
          <FileText aria-hidden="true" size={15} />
          简历 ID：<code className="max-w-64 truncate font-mono text-[#5f5363]">{resumeId}</code>
        </div>
        <Button
          className="mt-7 rounded-xl bg-[#850477] hover:bg-[#6f0364]"
          onClick={() => navigate('/console')}
        >
          <ArrowLeft size={17} />
          返回控制台
        </Button>
      </section>
    </main>
  );
}
