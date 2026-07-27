import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

const features = [
  ['精确排版', '字号、行高、四边页边距和模块间距都能按数字调整，版式不再被预设限制。'],
  ['Markdown 内容', '简介、经历和技能支持列表、强调、链接等常用 Markdown，写作更高效。'],
  ['所见即所得 PDF', '服务端使用浏览器打印同一份 HTML，让在线预览与下载结果保持一致。'],
];

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#087EA4]">
          Built for the final page
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#172a31]">
          编辑时顺手，打印时可靠
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {features.map(([title, description]) => (
          <Card
            className="border-[#d5e8ed] bg-white/80 shadow-[0_10px_35px_rgba(8,126,164,0.07)]"
            data-testid="home-feature-card"
            key={title}
          >
            <CardHeader className="p-5 pb-0">
              <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-3">
              <p className="text-sm leading-6 text-[#60777f]">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
