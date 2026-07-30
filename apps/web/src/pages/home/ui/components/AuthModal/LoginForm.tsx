import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';

import type { LoginFormValues } from '@/shared/auth/model/auth';
import { loginSchema } from '@/shared/auth/model/auth';
import { Button } from '@/shared/ui/button';
import { Form } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

type LoginFormProps = {
  isSubmitting: boolean;
  onSubmit: (values: LoginFormValues) => Promise<void>;
};

export function LoginForm({ isSubmitting, onSubmit }: LoginFormProps) {
  const [values, setValues] = useState<LoginFormValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormValues, string>>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = loginSchema.safeParse(values);
    if (!result.success) {
      setErrors(formErrors<LoginFormValues>(result.error.issues));
      return;
    }
    setErrors({});
    await onSubmit(result.data);
  }

  return (
    <Form className="mt-5 space-y-4" onSubmit={handleSubmit}>
      <Field
        error={errors.email}
        label="邮箱"
        onChange={(email) => setValues((current) => ({ ...current, email }))}
        type="email"
        value={values.email}
      />
      <Field
        error={errors.password}
        label="密码"
        onChange={(password) => setValues((current) => ({ ...current, password }))}
        type="password"
        value={values.password}
      />
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? '登录中...' : '登录'}
      </Button>
    </Form>
  );
}

type FieldProps = {
  autoComplete?: string;
  disabled?: boolean;
  error?: string;
  inputMode?: 'numeric';
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  suffix?: ReactNode;
  type: string;
  value: string;
};

export function Field({
  autoComplete,
  disabled,
  error,
  inputMode,
  label,
  maxLength,
  onChange,
  placeholder,
  suffix,
  type,
  value,
}: FieldProps) {
  const id = label;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          className={suffix ? 'pr-32' : undefined}
          disabled={disabled}
          id={id}
          inputMode={inputMode}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
        {suffix ? (
          <div className="absolute inset-y-0 right-1 flex items-center">{suffix}</div>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-red-600" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function formErrors<T extends Record<string, unknown>>(
  issues: { message: string; path: PropertyKey[] }[],
) {
  return issues.reduce<Partial<Record<keyof T, string>>>((acc, issue) => {
    const key = issue.path[0] as keyof T;
    if (key && !acc[key]) {
      acc[key] = issue.message;
    }
    return acc;
  }, {});
}
