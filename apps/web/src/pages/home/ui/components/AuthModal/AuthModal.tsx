import { useState } from 'react';

import type { AuthSession, LoginFormValues, RegisterFormValues } from '@/shared/auth/model/auth';
import { authErrorMessage } from '@/shared/auth/model/auth';
import { authService } from '@/shared/auth/api/auth.service';
import { useAuthStore } from '@/shared/auth/store/auth.store';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

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
    <Dialog onOpenChange={onOpenChange} open={open}>
      <AuthModalContent
        defaultMode={defaultMode}
        key={defaultMode}
        onAuthenticated={onAuthenticated}
        onOpenChange={onOpenChange}
      />
    </Dialog>
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
    <DialogContent>
      <DialogTitle>账号登录</DialogTitle>
      <DialogDescription>
        登录或注册后进入 Console。
      </DialogDescription>

      {formError ? (
        <Alert className="mt-4">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs
        className="mt-5"
        onValueChange={(value) => setMode(value as AuthMode)}
        value={mode}
      >
        <TabsList>
          <TabsTrigger value="login">登录</TabsTrigger>
          <TabsTrigger value="register">注册</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <LoginForm isSubmitting={isSubmitting} onSubmit={submitLogin} />
        </TabsContent>
        <TabsContent value="register">
          <RegisterForm isSubmitting={isSubmitting} onSubmit={submitRegister} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}
