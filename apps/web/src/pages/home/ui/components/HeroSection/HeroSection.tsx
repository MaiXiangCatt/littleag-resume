import { Rocket } from 'lucide-react';

import heroImg from '@/pages/home/assets/hero.png';
import { Button } from '@/shared/ui/button';

import { ViewExampleButton } from '../../HomePage';

type HeroSectionProps = {
  onRegister: () => void;
  onViewExample: () => void;
};

export function HeroSection({ onRegister, onViewExample }: HeroSectionProps) {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-64px)] max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#087EA4]">
          Write · Preview · Export
        </p>
        <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-[#172a31] sm:text-7xl">
          LittleAg
          <span className="text-[#087EA4]">Resume</span>
        </h1>
        <p className="mt-6 text-2xl font-medium text-[#20343b]">把经历写清楚，把版式交给你</p>
        <p className="mt-5 max-w-xl text-base leading-7 text-[#60777f]">
          用结构化字段整理经历，用 Markdown 写好内容，再通过精确排版和实时预览导出无水印
          PDF。每一次修改，都忠实落在最终成品里。
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={onRegister} size="lg" type="button">
            <Rocket aria-hidden="true" size={17} />
            免费开始
          </Button>
          <ViewExampleButton onClick={onViewExample} />
        </div>
      </div>

      <div className="relative">
        <div className="absolute -left-5 top-9 h-24 w-24 border-l-2 border-t-2 border-[#41B9E0]/75" />
        <div className="rounded-xl border border-[#cfe5eb] bg-white p-4 shadow-[0_24px_70px_rgba(8,126,164,0.15)]">
          <img
            alt="简历示例预览"
            className="mx-auto h-auto w-full max-w-sm rounded-lg object-cover"
            src={heroImg}
          />
        </div>
      </div>
    </section>
  );
}
