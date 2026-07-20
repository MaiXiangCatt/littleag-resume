import { useAuthStore } from '@/shared/auth/store/auth.store';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

type ConsolePageProps = {
  onLogout?: () => void;
};

export function ConsolePage({ onLogout }: ConsolePageProps) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === 'loading') {
    return <main className="p-8 text-slate-600">正在加载账号信息</main>;
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
        {onLogout ? (
          <Button className="mt-6" onClick={onLogout} type="button" variant="outline">
            退出登录
          </Button>
        ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
