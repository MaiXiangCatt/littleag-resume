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
          <article
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            data-testid="home-feature-card"
            key={title}
          >
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
