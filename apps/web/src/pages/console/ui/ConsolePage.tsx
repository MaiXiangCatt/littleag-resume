import { useState } from 'react';

import { useAuthStore } from '@/shared/auth/store/auth.store';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

type ConsolePageProps = {
  onLogout?: () => Promise<void>;
};

export function ConsolePage({ onLogout }: ConsolePageProps) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const authError = useAuthStore((state) => state.error);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setLoggingOut] = useState(false);

  if (status === 'loading') {
    return <main className="p-8 text-slate-600">正在加载账号信息</main>;
  }

  if (status === 'error') {
    return (
      <main className="p-8 text-slate-600">
        {authError ?? '暂时无法恢复登录状态，请刷新重试'}
      </main>
    );
  }

  async function handleLogout() {
    if (!onLogout || isLoggingOut) {
      return;
    }
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await onLogout();
    } catch {
      setLogoutError('退出登录失败，请稍后重试');
    } finally {
      setLoggingOut(false);
    }
  }

  if (!user) {
    return <main className="p-8 text-slate-600">请先登录</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-950">
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardDescription>Console</CardDescription>
          <CardTitle>{user.username}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600">{user.email}</p>
          {logoutError ? <p className="mt-4 text-sm text-red-600">{logoutError}</p> : null}
          {onLogout ? (
            <Button
              className="mt-6"
              disabled={isLoggingOut}
              onClick={handleLogout}
              type="button"
              variant="outline"
            >
              {isLoggingOut ? '退出中...' : '退出登录'}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
