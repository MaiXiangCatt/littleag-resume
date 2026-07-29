import { Rocket } from 'lucide-react';
import { Button } from '@/shared/ui/button';


type HeroSectionProps = {
  onRegister: () => void;
};

export function HeroSection({ onRegister }: HeroSectionProps) {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-64px)] max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-[#172a31] sm:text-7xl">
          LittleAg
          <span className="text-[#087EA4]">Resume</span>
        </h1>
        <p className="mt-6 text-2xl font-medium text-[#20343b]">一个用爱发电的开源项目</p>
        <p className="mt-5 max-w-xl text-base leading-7 text-[#60777f]">
          不知道写点什么...祝大家天天开心，找工作顺利吧～
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={onRegister} size="lg" type="button">
            <Rocket aria-hidden="true" size={17} />
            免费开始
          </Button>
        </div>
      </div>

    </section>
  );
}
