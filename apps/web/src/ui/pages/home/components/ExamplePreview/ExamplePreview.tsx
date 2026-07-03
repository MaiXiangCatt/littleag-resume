import { forwardRef } from 'react';

export const ExamplePreview = forwardRef<HTMLElement>(function ExamplePreview(_, ref) {
  return (
    <section
      className="bg-white px-4 py-16 outline-none sm:px-6"
      data-testid="example-preview"
      ref={ref}
      tabIndex={-1}
    >
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="text-3xl font-semibold text-slate-950">示例预览</h2>
          <p className="mt-3 leading-7 text-slate-600">
            示例保留在当前页面，便于用户先判断结构、密度和表达方式，再决定是否注册。
          </p>
        </div>
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-5">
          {['个人摘要', '核心经历', '项目成果', '教育背景'].map((item) => (
            <div className="rounded-md border border-slate-200 bg-white p-4" key={item}>
              <p className="text-sm font-medium text-slate-950">{item}</p>
              <div className="mt-3 h-2 rounded bg-slate-200" />
              <div className="mt-2 h-2 w-3/4 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
