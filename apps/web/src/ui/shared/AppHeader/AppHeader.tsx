import type { ReactNode } from 'react';

import type { AuthUser } from '@/models/auth';

type AppHeaderProps = {
  actions: ReactNode;
  currentUser: AuthUser | null;
};

export function AppHeader({ actions, currentUser }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur" role="banner">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <a className="text-base font-semibold text-slate-950" href="/">
          VegaResume
        </a>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="rounded-md border border-slate-200 px-3 py-1.5 text-right">
              <p className="text-sm font-medium leading-none text-slate-950">{currentUser.username}</p>
              <p className="mt-1 text-xs leading-none text-slate-500">{currentUser.email}</p>
            </div>
          ) : null}
          {actions}
        </div>
      </div>
    </header>
  );
}
