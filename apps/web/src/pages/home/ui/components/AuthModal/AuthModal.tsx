import { useState } from 'react';

import type {
  AuthSession,
  EmailVerificationFormValues,
  LoginFormValues,
  PendingEmailVerification,
  RegisterFormValues,
} from '@/shared/auth/model/auth';
import { authErrorMessage } from '@/shared/auth/model/auth';
import { authService } from '@/shared/auth/api/auth.service';
import { useAuthStore } from '@/shared/auth/store/auth.store';
import { ApiError } from '@/shared/http/http.client';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

import { EmailVerificationForm } from './EmailVerificationForm';
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

type AuthModalContentProps = Pick<
  AuthModalProps,
  'defaultMode' | 'onAuthenticated' | 'onOpenChange'
>;

function AuthModalContent({ defaultMode, onAuthenticated, onOpenChange }: AuthModalContentProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<PendingEmailVerification | null>(
    null,
  );
  const [verificationRevision, setVerificationRevision] = useState(0);
  const setSession = useAuthStore((state) => state.setSession);

  async function submitLogin(values: LoginFormValues) {
    if (isSubmitting) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      completeAuthentication(await authService.login(values));
    } catch (error) {
      if (error instanceof ApiError && error.code === 101011) {
        try {
          const verification = await authService.resendEmailVerification(
            values.email,
            values.password,
          );
          setPendingVerification({ ...verification, password: values.password });
          setVerificationRevision((current) => current + 1);
          return;
        } catch (resendError) {
          setFormError(authErrorMessage(resendError));
          return;
        }
      }
      setFormError(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRegister(values: RegisterFormValues) {
    if (isSubmitting) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const verification = await authService.register(values);
      setPendingVerification({ ...verification, password: values.password });
      setVerificationRevision((current) => current + 1);
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitVerification(values: EmailVerificationFormValues) {
    if (!pendingVerification || isSubmitting) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      completeAuthentication(
        await authService.confirmEmailVerification(pendingVerification.email, values),
      );
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function resendVerification() {
    if (!pendingVerification || isSubmitting) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const verification = await authService.resendEmailVerification(
        pendingVerification.email,
        pendingVerification.password,
      );
      setPendingVerification({ ...pendingVerification, ...verification });
      setVerificationRevision((current) => current + 1);
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function completeAuthentication(session: AuthSession) {
    setSession(session);
    onAuthenticated(session);
    onOpenChange(false);
  }

  return (
    <DialogContent>
      <DialogTitle>{pendingVerification ? '验证邮箱' : '账号登录'}</DialogTitle>
      <DialogDescription>
        {pendingVerification
          ? '输入邮件中的 6 位验证码，验证成功后将自动登录。'
          : '登录或注册后进入 Console。'}
      </DialogDescription>

      {formError ? (
        <Alert className="mt-4">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {pendingVerification ? (
        <EmailVerificationForm
          email={pendingVerification.email}
          isSubmitting={isSubmitting}
          key={verificationRevision}
          onBack={() => {
            setPendingVerification(null);
            setMode('login');
            setFormError(null);
          }}
          onResend={resendVerification}
          onSubmit={submitVerification}
          resendAfterSeconds={pendingVerification.resendAfterSeconds}
        />
      ) : (
        <Tabs
          className="mt-5"
          onValueChange={(value) => {
            setMode(value as AuthMode);
            setFormError(null);
          }}
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
      )}
    </DialogContent>
  );
}
