import { Eye, LogIn, Rocket } from 'lucide-react';
import { useRef } from 'react';

import type { AuthUser } from '@/shared/auth/model/auth';
import { AppHeader } from '@/shared/layout/AppHeader';
import { Button } from '@/shared/ui/button';

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
    <div
      className="min-h-screen overflow-x-hidden bg-[#f6f3ee] text-slate-950"
      data-testid="home-page"
    >
      <AppHeader
        actions={
          currentUser ? null : (
            <>
              <Button onClick={onLogin} type="button" variant="ghost">
                <LogIn aria-hidden="true" size={16} />
                登录
              </Button>
              <Button aria-label="顶部免费开始" onClick={onRegister} type="button">
                <Rocket aria-hidden="true" size={16} />
                免费开始
              </Button>
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
    <Button onClick={onClick} size="lg" type="button" variant="outline">
      <Eye aria-hidden="true" size={17} />
      查看示例
    </Button>
  );
}
