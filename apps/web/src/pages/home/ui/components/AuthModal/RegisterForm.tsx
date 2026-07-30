import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import type { RegisterFormValues } from '@/shared/auth/model/auth';
import { registerSchema, registrationEmailSchema } from '@/shared/auth/model/auth';
import { LEGAL_ROUTES } from '@/pages/legal/model/legal-routes';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Form } from '@/shared/ui/form';
import { Label } from '@/shared/ui/label';
import { Link } from '@/shared/ui/link';

import { Field } from './LoginForm';

type RegisterFormProps = {
  isSubmitting: boolean;
  onEmailChange: (email: string) => void;
  onSendCode: (email: string) => Promise<void>;
  onSubmit: (values: RegisterFormValues) => Promise<void>;
  resendAvailableAt?: number;
  verificationEmail?: string;
};

type RegistrationAgreements = {
  crossBorder: boolean;
  serviceAndPrivacy: boolean;
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
  const [agreements, setAgreements] = useState<RegistrationAgreements>({
    crossBorder: false,
    serviceAndPrivacy: false,
  });
  const [agreementError, setAgreementError] = useState<string>();
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormValues, string>>>({});
  const [now, setNow] = useState(() => Date.now());
  const verificationSent = resendAvailableAt !== undefined;
  const agreementsAccepted = agreements.crossBorder && agreements.serviceAndPrivacy;
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
    const nextAgreementError = agreementsAccepted ? undefined : '请先阅读并勾选两项协议';
    setAgreementError(nextAgreementError);
    if (!result.success) {
      setErrors((current) => ({ ...current, email: result.error.issues[0]?.message }));
    } else {
      setErrors((current) => ({ ...current, email: undefined }));
    }
    if (!result.success || nextAgreementError) {
      return;
    }
    await onSendCode(result.data.email);
    setNow(currentTimestamp());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = registerSchema.safeParse(values);
    const nextAgreementError = agreementsAccepted ? undefined : '请先阅读并勾选两项协议';
    setAgreementError(nextAgreementError);
    if (!result.success) {
      setErrors(registrationErrors(result.error.issues));
    } else {
      setErrors({});
    }
    if (!result.success || nextAgreementError) {
      return;
    }
    await onSubmit(result.data);
  }

  function updateAgreement(key: keyof RegistrationAgreements, checked: boolean) {
    const nextAgreements = { ...agreements, [key]: checked };
    setAgreements(nextAgreements);
    if (nextAgreements.crossBorder && nextAgreements.serviceAndPrivacy) {
      setAgreementError(undefined);
    }
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
      <div className="space-y-3 rounded-xl border border-border/80 bg-muted/35 p-3.5">
        <p className="text-xs font-medium text-foreground">创建账号前，请确认以下事项：</p>
        <div className="flex items-start gap-2.5">
          <Checkbox
            aria-label="同意用户服务协议及内容规则和隐私政策"
            checked={agreements.serviceAndPrivacy}
            id="registration-service-and-privacy"
            onCheckedChange={(checked) => updateAgreement('serviceAndPrivacy', checked === true)}
          />
          <div className="-mt-0.5 text-xs leading-5 text-muted-foreground">
            <Label
              className="cursor-pointer text-xs font-normal leading-5 text-muted-foreground"
              htmlFor="registration-service-and-privacy"
            >
              我已阅读并同意
            </Label>{' '}
            <LegalLink href={LEGAL_ROUTES.terms}>《用户服务协议及内容规则》</LegalLink>
            ，并已阅读
            <LegalLink href={LEGAL_ROUTES.privacy}>《隐私政策》</LegalLink>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Checkbox
            aria-label="单独同意个人信息跨境处理说明"
            checked={agreements.crossBorder}
            id="registration-cross-border"
            onCheckedChange={(checked) => updateAgreement('crossBorder', checked === true)}
          />
          <div className="-mt-0.5 text-xs leading-5 text-muted-foreground">
            <Label
              className="cursor-pointer text-xs font-normal leading-5 text-muted-foreground"
              htmlFor="registration-cross-border"
            >
              我已阅读
            </Label>{' '}
            <LegalLink href={LEGAL_ROUTES.crossBorder}>《个人信息跨境处理说明》</LegalLink>
            ，知悉账号信息、简历内容、头像及必要访问记录将在境外处理，并单独同意该等跨境处理
          </div>
        </div>
        {agreementError ? (
          <p className="text-xs font-medium text-destructive" role="alert">
            {agreementError}
          </p>
        ) : null}
      </div>
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
      <Button
        className="w-full"
        disabled={isSubmitting || !verificationSent || !agreementsAccepted}
        type="submit"
      >
        {submitLabel(isSubmitting, verificationSent)}
      </Button>
    </Form>
  );
}

function LegalLink({ children, href }: { children: string; href: string }) {
  return (
    <Link
      className="font-medium text-foreground underline decoration-border hover:decoration-primary"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </Link>
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
