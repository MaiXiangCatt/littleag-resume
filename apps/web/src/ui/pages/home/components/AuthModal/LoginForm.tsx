import { useState } from 'react';

import type { LoginFormValues } from '@/models/auth';
import { loginSchema } from '@/models/auth';

type LoginFormProps = {
  isSubmitting: boolean;
  onSubmit: (values: LoginFormValues) => Promise<void>;
};

export function LoginForm({ isSubmitting, onSubmit }: LoginFormProps) {
  const [values, setValues] = useState<LoginFormValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormValues, string>>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
    <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
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
      <button
        className="w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? '登录中...' : '登录'}
      </button>
    </form>
  );
}

type FieldProps = {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  type: string;
  value: string;
};

export function Field({ error, label, onChange, type, value }: FieldProps) {
  const id = label;

  return (
    <label className="block text-sm font-medium text-slate-800" htmlFor={id}>
      {label}
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function formErrors<T extends Record<string, unknown>>(issues: { message: string; path: PropertyKey[] }[]) {
  return issues.reduce<Partial<Record<keyof T, string>>>((acc, issue) => {
    const key = issue.path[0] as keyof T;
    if (key && !acc[key]) {
      acc[key] = issue.message;
    }
    return acc;
  }, {});
}
