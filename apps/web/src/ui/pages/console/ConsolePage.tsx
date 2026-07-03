import { useAuthStore } from '@/store/auth.store';

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
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">Console</p>
        <h1 className="mt-2 text-2xl font-semibold">{user.username}</h1>
        <p className="mt-1 text-slate-600">{user.email}</p>
        {onLogout ? (
          <button
            className="mt-6 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            onClick={onLogout}
            type="button"
          >
            退出登录
          </button>
        ) : null}
      </section>
    </main>
  );
}
