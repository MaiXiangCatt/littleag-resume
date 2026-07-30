import { lazy, Suspense, useEffect, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import { useAuthBootstrap } from '@/shared/auth/hooks/useAuthBootstrap';
import { useAuthStore } from '@/shared/auth/store/auth.store';
import { authService } from '@/shared/auth/api/auth.service';
import { Toaster } from '@/shared/ui/sonner';
import { AuthModal } from '@/pages/home/ui/components/AuthModal/AuthModal';
import { ConsolePage } from '@/pages/console/ui/ConsolePage';
import { HomePage } from '@/pages/home/ui/HomePage';
import type { LegalDocumentKey } from '@/pages/legal/model/legal-routes';

const ResumeEditorPage = lazy(() =>
  import('@/pages/resume-editor/ui/ResumeEditorPage').then((module) => ({
    default: module.ResumeEditorPage,
  })),
);

const PrintResumePage = lazy(() =>
  import('@/pages/print/ui/PrintResumePage').then((module) => ({
    default: module.PrintResumePage,
  })),
);

const LegalDocumentPage = lazy(() =>
  import('@/pages/legal/ui/LegalDocumentPage').then((module) => ({
    default: module.LegalDocumentPage,
  })),
);

type AuthMode = 'login' | 'register';

export function App() {
  return (
    <>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export function AppRoutes() {
  useAuthBootstrap();

  return (
    <Routes>
      <Route element={<HomeRoute />} path="/" />
      <Route element={<LegalDocumentRoute documentKey="terms" />} path="/legal/terms" />
      <Route element={<LegalDocumentRoute documentKey="privacy" />} path="/legal/privacy" />
      <Route
        element={<LegalDocumentRoute documentKey="crossBorder" />}
        path="/legal/cross-border"
      />
      <Route element={<ConsoleRoute />} path="/console" />
      <Route element={<GuestResumeEditorRoute />} path="/guest/edit" />
      <Route element={<ResumeEditorRoute />} path="/resumes/:resumeId/edit" />
      <Route element={<PrintResumeRoute />} path="/print/resumes/:resumeId" />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}

function LegalDocumentRoute({ documentKey }: { documentKey: LegalDocumentKey }) {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-slate-600">
          正在加载法律文本
        </main>
      }
    >
      <LegalDocumentPage documentKey={documentKey} />
    </Suspense>
  );
}

function GuestResumeEditorRoute() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-slate-600">
          正在加载游客编辑器
        </main>
      }
    >
      <ResumeEditorPage mode="guest" resumeId="guest-primary" />
    </Suspense>
  );
}

function ResumeEditorRoute() {
  const status = useAuthStore((state) => state.status);
  const { resumeId } = useParams<{ resumeId: string }>();

  if (status === 'idle' || status === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center text-slate-600">正在加载账号信息</main>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate replace to="/" />;
  }

  if (!resumeId) {
    return <Navigate replace to="/console" />;
  }

  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-slate-600">
          正在加载简历编辑器
        </main>
      }
    >
      <ResumeEditorPage resumeId={resumeId} />
    </Suspense>
  );
}

function PrintResumeRoute() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const location = useLocation();
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  const missingParams = !resumeId || !token;

  useEffect(() => {
    if (missingParams) {
      document.body.dataset.printError = '打印链接缺少参数';
    }
  }, [missingParams]);

  if (missingParams) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <PrintResumePage resumeId={resumeId} token={token} />
    </Suspense>
  );
}

function HomeRoute() {
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  if (status === 'authenticated') {
    return <Navigate replace to="/console" />;
  }

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthModalOpen(true);
  }

  function handleAuthenticated() {
    setAuthModalOpen(false);
  }

  return (
    <>
      <HomePage
        currentUser={user}
        onGuest={() => navigate('/guest/edit')}
        onLogin={() => openAuth('login')}
        onRegister={() => openAuth('register')}
        onViewExample={() => undefined}
      />
      <AuthModal
        defaultMode={authMode}
        onAuthenticated={handleAuthenticated}
        onOpenChange={setAuthModalOpen}
        open={authModalOpen}
      />
    </>
  );
}

function ConsoleRoute() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((state) => state.clearSession);
  const status = useAuthStore((state) => state.status);

  if (status === 'idle' || status === 'loading') {
    return <ConsolePage />;
  }

  if (status !== 'authenticated') {
    return <Navigate replace to="/" />;
  }

  return (
    <ConsolePage
      onLogout={async () => {
        await authService.logout();
        clearSession();
        navigate('/', { replace: true });
      }}
    />
  );
}
