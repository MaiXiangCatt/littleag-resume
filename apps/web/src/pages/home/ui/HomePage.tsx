import { Eye, LogIn, Rocket, UserRoundSearch } from 'lucide-react';
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
  onGuest: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onViewExample: () => void;
};

export function HomePage({
  currentUser,
  onGuest,
  onLogin,
  onRegister,
  onViewExample,
}: HomePageProps) {
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
      className="min-h-screen overflow-x-hidden bg-[#f4fbfd] text-[#172a31]"
      data-testid="home-page"
    >
      <AppHeader
        actions={
          currentUser ? null : (
            <>
              <Button
                aria-label="进入游客模式"
                className="px-2.5 sm:px-4"
                onClick={onGuest}
                type="button"
                variant="outline"
              >
                <UserRoundSearch aria-hidden="true" size={16} />
                <span className="sm:hidden">游客</span>
                <span className="hidden sm:inline">游客模式</span>
              </Button>
              <Button aria-label="登录" onClick={onLogin} type="button" variant="ghost">
                <LogIn aria-hidden="true" size={16} />
                <span className="hidden sm:inline">登录</span>
              </Button>
              <Button
                aria-label="顶部免费开始"
                className="px-2.5 sm:px-4"
                onClick={onRegister}
                type="button"
              >
                <Rocket aria-hidden="true" className="hidden sm:block" size={16} />
                <span className="sm:hidden">开始</span>
                <span className="hidden sm:inline">免费开始</span>
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
