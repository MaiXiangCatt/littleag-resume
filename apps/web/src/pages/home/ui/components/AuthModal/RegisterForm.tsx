import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import type { RegisterFormValues } from '@/shared/auth/model/auth';
import { registerSchema, registrationEmailSchema } from '@/shared/auth/model/auth';
import { Button } from '@/shared/ui/button';
import { Form } from '@/shared/ui/form';

import { Field } from './LoginForm';

type RegisterFormProps = {
  isSubmitting: boolean;
  onEmailChange: (email: string) => void;
  onSendCode: (email: string) => Promise<void>;
  onSubmit: (values: RegisterFormValues) => Promise<void>;
  resendAvailableAt?: number;
  verificationEmail?: string;
};

export function RegisterForm({
  isSubmitting,
  onEmailChange,
  onSendCode,
  onSubmit,
  resendAvailableAt,
  verificationEmail,
}: RegisterFormProps) {
  const [values, setValues] = useState<RegisterFormValues>({
    confirmPassword: '',
    email: '',
    password: '',
    username: '',
    verificationCode: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormValues, string>>>({});
  const [now, setNow] = useState(() => Date.now());
  const verificationSent = resendAvailableAt !== undefined;
  const remainingSeconds = resendAvailableAt
    ? Math.max(0, Math.ceil((resendAvailableAt - now) / 1_000))
    : 0;

  useEffect(() => {
    if (!resendAvailableAt || remainingSeconds <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setNow(currentTimestamp()), 1_000);
    return () => window.clearTimeout(timer);
  }, [remainingSeconds, resendAvailableAt]);

  async function handleSendCode() {
    if (isSubmitting) {
      return;
    }
    if (verificationSent && remainingSeconds > 0) {
      return;
    }
    const result = registrationEmailSchema.safeParse({ email: values.email });
    if (!result.success) {
      setErrors((current) => ({ ...current, email: result.error.issues[0]?.message }));
      return;
    }
    setErrors((current) => ({ ...current, email: undefined }));
    await onSendCode(result.data.email);
    setNow(currentTimestamp());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = registerSchema.safeParse(values);
    if (!result.success) {
      setErrors(registrationErrors(result.error.issues));
      return;
    }
    setErrors({});
    await onSubmit(result.data);
  }

  return (
    <Form className="mt-5 space-y-4" onSubmit={handleSubmit}>
      <Field
        error={errors.username}
        label="用户名"
        onChange={(username) => setValues((current) => ({ ...current, username }))}
        type="text"
        value={values.username}
      />
      <Field
        error={errors.email}
        label="邮箱"
        onChange={(email) => {
          setValues((current) => ({ ...current, email, verificationCode: '' }));
          onEmailChange(email);
        }}
        suffix={
          <Button
            aria-label={sendCodeAccessibleLabel(isSubmitting, verificationSent, remainingSeconds)}
            className="h-8 px-3 text-xs"
            disabled={isSubmitting || (verificationSent && remainingSeconds > 0)}
            onClick={handleSendCode}
            type="button"
            variant="ghost"
          >
            {sendCodeLabel(isSubmitting, verificationSent, remainingSeconds)}
          </Button>
        }
        type="email"
        value={values.email}
      />
      {!verificationSent ? (
        <p className="-mt-2 text-xs text-muted-foreground">填写邮箱即可获取验证码。</p>
      ) : null}
      <Field
        error={errors.password}
        label="密码"
        onChange={(password) => setValues((current) => ({ ...current, password }))}
        type="password"
        value={values.password}
      />
      <Field
        error={errors.confirmPassword}
        label="确认密码"
        onChange={(confirmPassword) => setValues((current) => ({ ...current, confirmPassword }))}
        type="password"
        value={values.confirmPassword}
      />
      {verificationSent ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
          <p className="mb-3 text-xs text-emerald-800">
            验证码已发送至 {verificationEmail}，请在有效期内完成注册。
          </p>
          <Field
            autoComplete="one-time-code"
            error={errors.verificationCode}
            inputMode="numeric"
            label="邮箱验证码"
            maxLength={6}
            onChange={(verificationCode) =>
              setValues((current) => ({
                ...current,
                verificationCode: verificationCode.replace(/\D/g, '').slice(0, 6),
              }))
            }
            type="text"
            value={values.verificationCode}
          />
        </div>
      ) : null}
      <Button className="w-full" disabled={isSubmitting || !verificationSent} type="submit">
        {submitLabel(isSubmitting, verificationSent)}
      </Button>
    </Form>
  );
}

function registrationErrors(
  issues: { message: string; path: PropertyKey[] }[],
): Partial<Record<keyof RegisterFormValues, string>> {
  return issues.reduce<Partial<Record<keyof RegisterFormValues, string>>>((acc, issue) => {
    const key = issue.path[0] as keyof RegisterFormValues;
    if (key && !acc[key]) {
      acc[key] = issue.message;
    }
    return acc;
  }, {});
}

function sendCodeLabel(
  isSubmitting: boolean,
  verificationSent: boolean,
  remainingSeconds: number,
): string {
  if (isSubmitting) {
    return verificationSent ? '处理中…' : '发送中…';
  }
  if (!verificationSent) {
    return '发送验证码';
  }
  return remainingSeconds > 0 ? `${remainingSeconds}s` : '重新发送';
}

function submitLabel(isSubmitting: boolean, verificationSent: boolean): string {
  if (isSubmitting) {
    return '处理中...';
  }
  return verificationSent ? '验证并创建账号' : '请先发送验证码';
}

function sendCodeAccessibleLabel(
  isSubmitting: boolean,
  verificationSent: boolean,
  remainingSeconds: number,
): string {
  if (verificationSent && remainingSeconds > 0 && !isSubmitting) {
    return `${remainingSeconds} 秒后可重新发送验证码`;
  }
  return sendCodeLabel(isSubmitting, verificationSent, remainingSeconds);
}

function currentTimestamp(): number {
  return Date.now();
}
