import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

const features = [
  ['结构先行', '围绕岗位目标组织信息，避免把经历堆成无法扫描的长文。'],
  ['表达克制', '强调结果、影响和证据，让简历在短时间内给出可信判断。'],
  ['持续迭代', '后续 Console 会承载版本管理、模板和导出流程。'],
];

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="grid gap-4 md:grid-cols-3">
        {features.map(([title, description]) => (
          <Card
            className="shadow-sm"
            data-testid="home-feature-card"
            key={title}
          >
            <CardHeader className="p-5 pb-0">
              <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-3">
              <p className="text-sm leading-6 text-slate-600">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
