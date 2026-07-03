import { z } from 'zod';

export type AuthUser = {
  id: string;
  username: string;
  email: string;
};

export type AuthSession = {
  accessToken: string;
  user: AuthUser;
};

export type ApiErrorPayload = {
  code: number;
  message: string;
  data: null;
};

export const loginSchema = z.object({
  email: z.email('请输入有效邮箱'),
  password: z.string().min(1, '请输入密码'),
});

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(2, '请输入 2-32 位用户名')
      .max(32, '请输入 2-32 位用户名')
      .regex(/^[A-Za-z0-9_\u4e00-\u9fa5-]+$/, '用户名仅支持中英文、数字、下划线和连字符'),
    email: z.email('请输入有效邮箱'),
    password: z.string().min(8, '密码至少 8 位'),
    confirmPassword: z.string().min(8, '请确认密码'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const authErrorMessages: Record<number, string> = {
  100001: '请求参数格式错误',
  100003: '请先登录',
  101001: '邮箱已注册',
  101002: '邮箱或密码不正确',
  101003: '登录已过期，请重新登录',
  101004: '登录状态无效，请重新登录',
  101005: '密码强度不足',
  101006: '邮箱格式不正确',
  101007: '用户名已被使用',
  101008: '用户名格式不正确',
  101009: '账号已临时锁定，请稍后再试',
  101010: '登录状态已失效，请重新登录',
};

export function authErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = Number((error as { code: unknown }).code);
    return authErrorMessages[code] ?? '请求失败，请稍后再试';
  }
  return '请求失败，请稍后再试';
}
