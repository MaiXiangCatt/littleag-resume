import { Eye, LogIn, Rocket } from 'lucide-react';
import { useRef } from 'react';

import type { AuthUser } from '@/models/auth';
import { AppHeader } from '@/ui/shared/AppHeader';

import { ExamplePreview } from './components/ExamplePreview/ExamplePreview';
import { FeaturesSection } from './components/FeaturesSection/FeaturesSection';
import { Footer } from './components/Footer/Footer';
import { HeroSection } from './components/HeroSection/HeroSection';

type HomePageProps = {
  currentUser: AuthUser | null;
  onLogin: () => void;
  onRegister: () => void;
  onViewExample: () => void;
};

export function HomePage({ currentUser, onLogin, onRegister, onViewExample }: HomePageProps) {
  const exampleRef = useRef<HTMLElement>(null);

  function viewExample() {
    onViewExample();
    exampleRef.current?.focus();
    if (typeof exampleRef.current?.scrollIntoView === 'function') {
      exampleRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f3ee] text-slate-950" data-testid="home-page">
      <AppHeader
        actions={
          currentUser ? null : (
            <>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                onClick={onLogin}
                type="button"
              >
                <LogIn aria-hidden="true" size={16} />
                登录
              </button>
              <button
                aria-label="顶部免费开始"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white"
                onClick={onRegister}
                type="button"
              >
                <Rocket aria-hidden="true" size={16} />
                免费开始
              </button>
            </>
          )
        }
        currentUser={currentUser}
      />
      <main>
        <HeroSection onRegister={onRegister} onViewExample={viewExample} />
        <ExamplePreview ref={exampleRef} />
        <FeaturesSection />
      </main>
      <Footer />
    </div>
  );
}

export function ViewExampleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:border-slate-500"
      onClick={onClick}
      type="button"
    >
      <Eye aria-hidden="true" size={17} />
      查看示例
    </button>
  );
}
