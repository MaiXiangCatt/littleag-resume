import { useState } from 'react';

import type {
  AuthSession,
  EmailVerification,
  EmailVerificationFormValues,
  LoginFormValues,
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
type VerificationFlow = 'login' | 'register';

type PendingVerification = EmailVerification & {
  flow: VerificationFlow;
  password?: string;
  resendAvailableAt: number;
};

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
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
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
          setPendingVerification({
            ...verification,
            flow: 'login',
            password: values.password,
            resendAvailableAt: verificationDeadline(verification.resendAfterSeconds),
          });
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

  async function sendRegistrationVerification(email: string) {
    if (isSubmitting) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const verification = await authService.sendRegistrationEmailVerification(email);
      setPendingVerification({
        ...verification,
        flow: 'register',
        resendAvailableAt: verificationDeadline(verification.resendAfterSeconds),
      });
    } catch (error) {
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
      completeAuthentication(await authService.register(values));
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitVerification(values: EmailVerificationFormValues) {
    if (!pendingVerification || !pendingVerification.password || isSubmitting) {
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
    if (!pendingVerification || !pendingVerification.password || isSubmitting) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const verification = await authService.resendEmailVerification(
        pendingVerification.email,
        pendingVerification.password,
      );
      setPendingVerification({
        ...pendingVerification,
        ...verification,
        resendAvailableAt: verificationDeadline(verification.resendAfterSeconds),
      });
      if (pendingVerification.flow === 'login') {
        setVerificationRevision((current) => current + 1);
      }
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

  const standaloneVerification = pendingVerification?.flow === 'login';

  return (
    <DialogContent>
      <DialogTitle>{authDialogTitle(mode, standaloneVerification)}</DialogTitle>
      <DialogDescription>{authDialogDescription(mode, standaloneVerification)}</DialogDescription>

      {formError ? (
        <Alert className="mt-4">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {standaloneVerification && pendingVerification ? (
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
            <RegisterForm
              isSubmitting={isSubmitting}
              onEmailChange={(email) => {
                if (
                  pendingVerification?.flow === 'register' &&
                  normalizeEmail(email) !== normalizeEmail(pendingVerification.email)
                ) {
                  setPendingVerification(null);
                }
              }}
              onSendCode={sendRegistrationVerification}
              onSubmit={submitRegister}
              resendAvailableAt={
                pendingVerification?.flow === 'register'
                  ? pendingVerification.resendAvailableAt
                  : undefined
              }
              verificationEmail={
                pendingVerification?.flow === 'register' ? pendingVerification.email : undefined
              }
            />
          </TabsContent>
        </Tabs>
      )}
    </DialogContent>
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function verificationDeadline(resendAfterSeconds: number): number {
  return Date.now() + resendAfterSeconds * 1_000;
}

function authDialogTitle(mode: AuthMode, standaloneVerification: boolean): string {
  if (standaloneVerification) {
    return '验证邮箱';
  }
  return mode === 'register' ? '创建账号' : '账号登录';
}

function authDialogDescription(mode: AuthMode, standaloneVerification: boolean): string {
  if (standaloneVerification) {
    return '输入邮件中的 6 位验证码，验证成功后将自动登录。';
  }
  if (mode === 'register') {
    return '填写注册信息并完成邮箱验证，验证成功后将自动登录。';
  }
  return '登录后进入 Console。';
}
