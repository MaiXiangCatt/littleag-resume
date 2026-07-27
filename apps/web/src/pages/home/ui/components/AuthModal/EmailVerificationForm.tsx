import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import type { EmailVerificationFormValues } from '@/shared/auth/model/auth';
import { emailVerificationSchema } from '@/shared/auth/model/auth';
import { Button } from '@/shared/ui/button';
import { Form } from '@/shared/ui/form';

import { Field } from './LoginForm';

type EmailVerificationFormProps = {
  email: string;
  isSubmitting: boolean;
  onBack: () => void;
  onResend: () => Promise<void>;
  onSubmit: (values: EmailVerificationFormValues) => Promise<void>;
  resendAfterSeconds: number;
};

export function EmailVerificationForm({
  email,
  isSubmitting,
  onBack,
  onResend,
  onSubmit,
  resendAfterSeconds,
}: EmailVerificationFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [remainingSeconds, setRemainingSeconds] = useState(resendAfterSeconds);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [remainingSeconds]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = emailVerificationSchema.safeParse({ code });
    if (!result.success) {
      setError(result.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    await onSubmit(result.data);
  }

  async function handleResend() {
    if (remainingSeconds > 0 || isSubmitting) {
      return;
    }
    await onResend();
  }

  return (
    <Form className="mt-5 space-y-4" onSubmit={handleSubmit}>
      <p className="text-sm text-muted-foreground">
        验证码已发送至 <span className="font-medium text-foreground">{email}</span>
      </p>
      <Field
        autoComplete="one-time-code"
        error={error}
        inputMode="numeric"
        label="邮箱验证码"
        maxLength={6}
        onChange={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
        type="text"
        value={code}
      />
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? '验证中...' : '验证并登录'}
      </Button>
      <div className="flex items-center justify-between">
        <Button disabled={isSubmitting} onClick={onBack} type="button" variant="ghost">
          返回登录
        </Button>
        <Button
          disabled={isSubmitting || remainingSeconds > 0}
          onClick={handleResend}
          type="button"
          variant="ghost"
        >
          {remainingSeconds > 0 ? `${remainingSeconds} 秒后可重发` : '重新发送验证码'}
        </Button>
      </div>
    </Form>
  );
}
