import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

import { authErrorMessage } from '@/models/auth';
import type { AuthSession, LoginFormValues, RegisterFormValues } from '@/models/auth';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';

import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

type AuthMode = 'login' | 'register';

type AuthModalProps = {
  defaultMode: AuthMode;
  onAuthenticated: (session: AuthSession) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AuthModal({ defaultMode, onAuthenticated, onOpenChange, open }: AuthModalProps) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/40" />
        <AuthModalContent
          defaultMode={defaultMode}
          key={defaultMode}
          onAuthenticated={onAuthenticated}
          onOpenChange={onOpenChange}
        />
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type AuthModalContentProps = Pick<AuthModalProps, 'defaultMode' | 'onAuthenticated' | 'onOpenChange'>;

function AuthModalContent({
  defaultMode,
  onAuthenticated,
  onOpenChange,
}: AuthModalContentProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  async function submitLogin(values: LoginFormValues) {
    if (isSubmitting) {
      return;
    }
    await submit(() => authService.login(values));
  }

  async function submitRegister(values: RegisterFormValues) {
    if (isSubmitting) {
      return;
    }
    await submit(() => authService.register(values));
  }

  async function submit(action: () => Promise<AuthSession>) {
    setSubmitting(true);
    setFormError(null);
    try {
      const session = await action();
      setSession(session);
      onAuthenticated(session);
      onOpenChange(false);
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 text-left shadow-xl">
      <Dialog.Title className="text-xl font-semibold text-slate-950">账号登录</Dialog.Title>
      <Dialog.Description className="mt-1 text-sm text-slate-500">
        登录或注册后进入 Console。
      </Dialog.Description>

      <div className="mt-5 grid grid-cols-2 rounded-md bg-slate-100 p-1" role="tablist">
        <button
          aria-selected={mode === 'login'}
          className="rounded px-3 py-2 text-sm data-[selected=true]:bg-white"
          data-selected={mode === 'login'}
          onClick={() => setMode('login')}
          role="tab"
          type="button"
        >
          登录
        </button>
        <button
          aria-selected={mode === 'register'}
          className="rounded px-3 py-2 text-sm data-[selected=true]:bg-white"
          data-selected={mode === 'register'}
          onClick={() => setMode('register')}
          role="tab"
          type="button"
        >
          注册
        </button>
      </div>

      {formError ? <p className="mt-4 text-sm text-red-600">{formError}</p> : null}

      {mode === 'login' ? (
        <LoginForm isSubmitting={isSubmitting} onSubmit={submitLogin} />
      ) : (
        <RegisterForm isSubmitting={isSubmitting} onSubmit={submitRegister} />
      )}
    </Dialog.Content>
  );
}
