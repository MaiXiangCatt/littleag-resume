import { Rocket, UserRoundSearch } from 'lucide-react';

// import example from '@/pages/home/assets/example.png';
import { Button } from '@/shared/ui/button';

type HeroSectionProps = {
  onRegister: () => void;
  onGuest: () => void;
};

export function HeroSection({ onRegister, onGuest }: HeroSectionProps) {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-64px)] max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-[#2f211f] sm:text-7xl">
          LittleAg
          <span className="text-[#bf301e]">Resume</span>
        </h1>
        <p className="mt-6 text-2xl font-medium text-[#372725]">一个用爱发电的开源项目</p>
        <p className="mt-5 max-w-xl text-base leading-7 text-[#746460]">
          不知道写点什么...祝大家天天开心，找工作顺利吧～
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={onRegister} size="lg" type="button">
            <Rocket aria-hidden="true" size={17} />
            免费开始
          </Button>
          <Button onClick={onGuest} size="lg" type="button" variant="outline">
            <UserRoundSearch aria-hidden="true" size={17} />
            游客模式
          </Button>
        </div>
      </div>

      {/* <div className="relative">
        <div className="absolute -left-5 top-9 h-48 w-24 border-l-2 border-t-2 border-[#d96657]/75" />
        <div className="rounded-xl border border-[#ead8d4] bg-white p-4 shadow-[0_24px_70px_rgba(191,48,30,0.15)]">
          <img
            alt="简历示例预览"
            className="mx-auto h-auto w-full max-w-sm rounded-lg object-cover"
            src={example}
          />
        </div>
      </div> */}
    </section>
  );
}
