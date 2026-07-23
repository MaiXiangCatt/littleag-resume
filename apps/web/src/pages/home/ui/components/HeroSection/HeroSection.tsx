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
    <section className="mx-auto grid min-h-[calc(100vh-64px)] max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.04fr_0.96fr]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Resume workflow for focused applications
        </p>
        <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] text-slate-950 sm:text-6xl">
          VegaResume
        </h1>
        <p className="mt-5 text-2xl font-medium text-slate-800">用一页好简历，开始下一次机会</p>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
          从结构化信息、风格选择到导出准备，VegaResume
          帮你把求职材料收束成清晰、可信、方便迭代的一页。
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
        <div className="absolute -left-4 top-8 h-24 w-24 border-l-2 border-t-2 border-emerald-700/60" />
        <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
          <img
            alt="简历示例预览"
            className="mx-auto h-auto w-full max-w-sm rounded-md object-cover"
            src={heroImg}
          />
        </div>
      </div>
    </section>
  );
}
