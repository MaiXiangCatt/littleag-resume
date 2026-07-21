import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useState } from 'react';

import { useAuthBootstrap } from '@/shared/auth/hooks/useAuthBootstrap';
import { useAuthStore } from '@/shared/auth/store/auth.store';
import { authService } from '@/shared/auth/api/auth.service';
import { AuthModal } from '@/pages/home/ui/components/AuthModal/AuthModal';
import { ConsolePage } from '@/pages/console/ui/ConsolePage';
import { HomePage } from '@/pages/home/ui/HomePage';

type AuthMode = 'login' | 'register';

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export function AppRoutes() {
  useAuthBootstrap();

  return (
    <Routes>
      <Route element={<HomeRoute />} path="/" />
      <Route element={<ConsoleRoute />} path="/console" />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
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
    navigate('/console', { replace: true });
  }

  return (
    <>
      <HomePage
        currentUser={user}
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
