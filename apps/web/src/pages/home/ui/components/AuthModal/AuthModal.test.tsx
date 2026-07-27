import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/shared/auth/store/auth.store';
import { ApiError } from '@/shared/http/http.client';

import { AuthModal } from './AuthModal';

const authServiceMock = vi.hoisted(() => ({
  confirmEmailVerification: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  resendEmailVerification: vi.fn(),
  sendRegistrationEmailVerification: vi.fn(),
}));

vi.mock('@/shared/auth/api/auth.service', () => ({
  authService: authServiceMock,
}));

describe('AuthModal', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    authServiceMock.confirmEmailVerification.mockReset();
    authServiceMock.login.mockReset();
    authServiceMock.register.mockReset();
    authServiceMock.resendEmailVerification.mockReset();
    authServiceMock.sendRegistrationEmailVerification.mockReset();
  });

  it('opens with the requested login or register tab', () => {
    const { rerender } = render(
      <AuthModal defaultMode="register" onAuthenticated={vi.fn()} onOpenChange={vi.fn()} open />,
    );

    expect(screen.getByRole('tab', { name: '注册' })).toHaveAttribute('aria-selected', 'true');

    rerender(
      <AuthModal defaultMode="login" onAuthenticated={vi.fn()} onOpenChange={vi.fn()} open />,
    );
    expect(screen.getByRole('tab', { name: '登录' })).toHaveAttribute('aria-selected', 'true');
  });

  it('validates registration fields before submitting', async () => {
    const user = userEvent.setup();
    render(
      <AuthModal defaultMode="register" onAuthenticated={vi.fn()} onOpenChange={vi.fn()} open />,
    );

    await user.click(screen.getByRole('button', { name: '发送验证码' }));

    expect(await screen.findByText('请输入有效邮箱')).toBeInTheDocument();
    expect(authServiceMock.register).not.toHaveBeenCalled();
  });

  it('maps backend error codes and prevents duplicate submit while loading', async () => {
    const user = userEvent.setup();
    let rejectSend: (error: unknown) => void = () => {};
    authServiceMock.sendRegistrationEmailVerification.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectSend = reject;
      }),
    );

    render(
      <AuthModal defaultMode="register" onAuthenticated={vi.fn()} onOpenChange={vi.fn()} open />,
    );

    await user.type(screen.getByLabelText('邮箱'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: '发送验证码' }));
    await user.click(await screen.findByRole('button', { name: '发送中…' }));

    await waitFor(() =>
      expect(authServiceMock.sendRegistrationEmailVerification).toHaveBeenCalledTimes(1),
    );
    await act(async () => {
      rejectSend({ code: 101001, message: 'Email exists' });
    });
    expect(await screen.findByText('邮箱已注册')).toBeInTheDocument();
  });

  it('stores session and notifies after successful login', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    authServiceMock.login.mockResolvedValueOnce({
      accessToken: 'access-token',
      user: {
        id: 'user-id',
        username: 'zhangsan',
        email: 'user@example.com',
        emailVerified: true,
      },
    });

    render(
      <AuthModal
        defaultMode="login"
        onAuthenticated={onAuthenticated}
        onOpenChange={vi.fn()}
        open
      />,
    );

    await user.type(screen.getByLabelText('邮箱'), 'user@example.com');
    await user.type(screen.getByLabelText('密码'), 'password1');
    await user.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());
    expect(useAuthStore.getState().accessToken).toBe('access-token');
  });

  it('verifies the email before creating a session after registration', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    authServiceMock.sendRegistrationEmailVerification.mockResolvedValueOnce({
      email: 'user@example.com',
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    authServiceMock.register.mockResolvedValueOnce({
      accessToken: 'verified-access-token',
      user: {
        id: 'user-id',
        username: 'zhangsan',
        email: 'user@example.com',
        emailVerified: true,
      },
    });

    render(
      <AuthModal
        defaultMode="register"
        onAuthenticated={onAuthenticated}
        onOpenChange={vi.fn()}
        open
      />,
    );

    await user.type(screen.getByLabelText('邮箱'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: '发送验证码' }));

    expect(await screen.findByText(/验证码已发送至/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('用户名'), 'zhangsan');
    await user.type(screen.getByLabelText('密码'), 'password1');
    await user.type(screen.getByLabelText('确认密码'), 'password1');
    expect(screen.getByLabelText('用户名')).toHaveValue('zhangsan');
    expect(screen.getByLabelText('用户名')).toBeEnabled();
    expect(screen.getByRole('tab', { name: '注册' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('heading', { name: '验证邮箱' })).not.toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();

    await user.type(screen.getByLabelText('邮箱验证码'), '123456');
    await user.click(screen.getByRole('button', { name: '验证并创建账号' }));

    await waitFor(() =>
      expect(authServiceMock.register).toHaveBeenCalledWith({
        confirmPassword: 'password1',
        email: 'user@example.com',
        password: 'password1',
        username: 'zhangsan',
        verificationCode: '123456',
      }),
    );
    expect(onAuthenticated).toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBe('verified-access-token');
  });

  it('continues an unverified login in the verification step', async () => {
    const user = userEvent.setup();
    authServiceMock.login.mockRejectedValueOnce(new ApiError(101011, 'Email not verified', 403));
    authServiceMock.resendEmailVerification.mockResolvedValueOnce({
      email: 'user@example.com',
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });

    render(<AuthModal defaultMode="login" onAuthenticated={vi.fn()} onOpenChange={vi.fn()} open />);

    await user.type(screen.getByLabelText('邮箱'), 'user@example.com');
    await user.type(screen.getByLabelText('密码'), 'password1');
    await user.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('验证码已发送至')).toBeInTheDocument();
    expect(authServiceMock.resendEmailVerification).toHaveBeenCalledWith(
      'user@example.com',
      'password1',
    );
  });
});
