import type { ReactNode } from 'react';

import type { AuthUser } from '@/shared/auth/model/auth';
import { Link } from '@/shared/ui/link';

type AppHeaderProps = {
  actions: ReactNode;
  currentUser: AuthUser | null;
};

export function AppHeader({ actions, currentUser }: AppHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-[#cfe5eb]/90 bg-[#f4fbfd]/90 backdrop-blur"
      role="banner"
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link className="text-lg font-semibold tracking-[-0.025em] no-underline" href="/">
          LittleAg<span className="text-[#087EA4]">Resume</span>
        </Link>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="rounded-md border border-slate-200 px-3 py-1.5 text-right">
              <p className="text-sm font-medium leading-none text-slate-950">
                {currentUser.username}
              </p>
              <p className="mt-1 text-xs leading-none text-slate-500">{currentUser.email}</p>
            </div>
          ) : null}
          {actions}
        </div>
      </div>
    </header>
  );
}
