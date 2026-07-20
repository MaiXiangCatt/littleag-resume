import type { FormEvent } from 'react';
import { useState } from 'react';

import type { RegisterFormValues } from '@/shared/auth/model/auth';
import { registerSchema } from '@/shared/auth/model/auth';
import { Button } from '@/shared/ui/button';
import { Form } from '@/shared/ui/form';

import { Field } from './LoginForm';

type RegisterFormProps = {
  isSubmitting: boolean;
  onSubmit: (values: RegisterFormValues) => Promise<void>;
};

export function RegisterForm({ isSubmitting, onSubmit }: RegisterFormProps) {
  const [values, setValues] = useState<RegisterFormValues>({
    confirmPassword: '',
    email: '',
    password: '',
    username: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormValues, string>>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = registerSchema.safeParse(values);
    if (!result.success) {
      setErrors(
        result.error.issues.reduce<Partial<Record<keyof RegisterFormValues, string>>>(
          (acc, issue) => {
            const key = issue.path[0] as keyof RegisterFormValues;
            if (key && !acc[key]) {
              acc[key] = issue.message;
            }
            return acc;
          },
          {},
        ),
      );
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
      <Field
        error={errors.confirmPassword}
        label="确认密码"
        onChange={(confirmPassword) =>
          setValues((current) => ({ ...current, confirmPassword }))
        }
        type="password"
        value={values.confirmPassword}
      />
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? '创建中...' : '创建账号'}
      </Button>
    </Form>
  );
}
