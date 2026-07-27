import { forwardRef } from 'react';

import { Card, CardContent } from '@/shared/ui/card';

export const ExamplePreview = forwardRef<HTMLElement>(function ExamplePreview(_, ref) {
  return (
    <section
      className="border-y border-[#d7e9ee] bg-white px-4 py-20 outline-none sm:px-6"
      data-testid="example-preview"
      ref={ref}
      tabIndex={-1}
    >
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#087EA4]">
            Live preview
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-[#172a31]">先看成品，再开始写</h2>
          <p className="mt-4 leading-7 text-[#60777f]">
            从内容结构到打印密度都可以实时确认。注册前先看清最终效果，注册后直接开始编辑。
          </p>
        </div>
        <div className="grid gap-3 rounded-xl border border-[#cfe5eb] bg-[#eff9fc] p-5">
          {['个人简介', '工作经历', '项目经历', '教育背景'].map((item) => (
            <Card className="rounded-lg border-[#dbecef] bg-white shadow-none" key={item}>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-[#20343b]">{item}</p>
                <div className="mt-3 h-2 rounded bg-[#cdebf3]" />
                <div className="mt-2 h-2 w-3/4 rounded bg-[#e5f4f7]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
});
