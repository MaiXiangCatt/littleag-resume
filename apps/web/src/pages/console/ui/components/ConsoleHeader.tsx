import { Bell, ChevronDown, CircleHelp, FileText, LogOut, Search, Settings } from 'lucide-react';
import { useEffect, useRef } from 'react';

import type { AuthUser } from '@/shared/auth/model/auth';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Link } from '@/shared/ui/link';

type ConsoleHeaderProps = {
  isLoggingOut: boolean;
  onLogout: () => void;
  onPlaceholder: (label: string) => void;
  onQueryChange: (query: string) => void;
  query: string;
  user: AuthUser;
};

export function ConsoleHeader({
  isLoggingOut,
  onLogout,
  onPlaceholder,
  onQueryChange,
  query,
  user,
}: ConsoleHeaderProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const initial = user.username.trim().charAt(0).toUpperCase() || 'V';

  return (
    <header className="sticky top-0 z-30 border-b border-[#ece8ef] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-20 max-w-[1560px] flex-wrap items-center gap-4 px-5 py-3 lg:flex-nowrap lg:px-10">
        <Link
          className="flex shrink-0 items-center gap-3 rounded-xl text-[#19131d] no-underline outline-none focus-visible:ring-2 focus-visible:ring-[#bf301e] focus-visible:ring-offset-4"
          href="/console"
        >
          <span className="relative grid size-10 place-items-center overflow-hidden rounded-xl bg-[#bf301e] text-white shadow-[0_8px_24px_rgba(191,48,30,0.24)]">
            <FileText aria-hidden="true" size={21} strokeWidth={1.9} />
            <span className="absolute -bottom-2 -right-2 size-5 rounded-full bg-[#ec9c8f]/70 blur-sm" />
          </span>
          <span className="text-xl font-bold tracking-[-0.035em] sm:text-2xl">LittleAgResume</span>
        </Link>

        <Label className="order-3 flex h-12 w-full cursor-text items-center gap-3 rounded-xl border border-[#ded9e2] bg-white px-4 leading-normal text-[#777080] shadow-[0_4px_16px_rgba(54,38,58,0.03)] transition focus-within:border-[#bf301e] focus-within:ring-4 focus-within:ring-[#bf301e]/8 lg:order-none lg:mx-auto lg:max-w-[440px]">
          <Search aria-hidden="true" className="shrink-0" size={21} strokeWidth={1.8} />
          <Input
            ref={searchRef}
            aria-label="搜索简历"
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[#211725] shadow-none outline-none ring-0 placeholder:text-[#99919d] focus-visible:ring-0"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索简历"
            value={query}
          />
          <kbd className="hidden rounded-md border border-[#e6e1e8] bg-[#faf9fb] px-2 py-1 text-xs font-medium text-[#7c7480] sm:inline-flex">
            {navigator.platform.toLowerCase().includes('mac') ? '⌘ K' : 'Ctrl K'}
          </kbd>
        </Label>

        <nav aria-label="账号操作" className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <Button
            aria-label="帮助"
            className="rounded-full text-[#655d69] hover:bg-[#f7eff7] hover:text-[#bf301e]"
            onClick={() => onPlaceholder('帮助中心')}
            size="icon"
            variant="ghost"
          >
            <CircleHelp size={22} strokeWidth={1.7} />
          </Button>
          <Button
            aria-label="通知"
            className="rounded-full text-[#655d69] hover:bg-[#f7eff7] hover:text-[#bf301e]"
            onClick={() => onPlaceholder('通知中心')}
            size="icon"
            variant="ghost"
          >
            <Bell size={22} strokeWidth={1.7} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="ml-1 h-auto gap-2 rounded-xl px-2 py-1.5 hover:bg-[#f8f3f8] focus-visible:ring-2 focus-visible:ring-[#bf301e]"
                variant="ghost"
              >
                <span className="grid size-9 place-items-center rounded-full bg-[#efe4ed] text-sm font-bold text-[#bf301e] ring-2 ring-white">
                  {initial}
                </span>
                <span className="hidden max-w-28 truncate text-sm font-semibold text-[#2f2632] sm:block">
                  {user.username}
                </span>
                <ChevronDown aria-hidden="true" className="text-[#837b86]" size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 rounded-2xl border-[#e9e3eb] p-2 shadow-[0_18px_55px_rgba(49,30,52,0.16)]"
            >
              <DropdownMenuLabel className="px-3 py-2.5">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#a63a2a]">
                  当前账号
                </p>
                <p className="mt-1 truncate text-sm font-normal text-[#817985]">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#eee9f0]" />
              <DropdownMenuItem
                className="mt-1 gap-2 rounded-xl px-3 py-2.5 text-sm text-[#514955] focus:bg-[#f8f3f8] focus:text-[#bf301e]"
                onClick={() => onPlaceholder('账号设置')}
              >
                <Settings aria-hidden="true" size={17} />
                账号设置
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 rounded-xl px-3 py-2.5 text-sm text-[#514955] focus:bg-red-50 focus:text-red-700"
                disabled={isLoggingOut}
                onClick={onLogout}
              >
                <LogOut aria-hidden="true" size={17} />
                {isLoggingOut ? '退出中…' : '退出登录'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
}
