import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/shared/auth/store/auth.store';

import { AuthModal } from './AuthModal';

const authServiceMock = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock('@/shared/auth/api/auth.service', () => ({
  authService: authServiceMock,
}));

describe('AuthModal', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    authServiceMock.login.mockReset();
    authServiceMock.register.mockReset();
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

    await user.click(screen.getByRole('button', { name: '创建账号' }));

    expect(await screen.findByText('请输入 2-32 位用户名')).toBeInTheDocument();
    expect(authServiceMock.register).not.toHaveBeenCalled();
  });

  it('maps backend error codes and prevents duplicate submit while loading', async () => {
    const user = userEvent.setup();
    let rejectRegister: (error: unknown) => void = () => {};
    authServiceMock.register.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectRegister = reject;
      }),
    );

    render(
      <AuthModal defaultMode="register" onAuthenticated={vi.fn()} onOpenChange={vi.fn()} open />,
    );

    await user.type(screen.getByLabelText('用户名'), 'zhangsan');
    await user.type(screen.getByLabelText('邮箱'), 'user@example.com');
    await user.type(screen.getByLabelText('密码'), 'password1');
    await user.type(screen.getByLabelText('确认密码'), 'password1');
    await user.click(screen.getByRole('button', { name: '创建账号' }));
    await user.click(await screen.findByRole('button', { name: '创建中...' }));

    await waitFor(() => expect(authServiceMock.register).toHaveBeenCalledTimes(1));
    await act(async () => {
      rejectRegister({ code: 101007, message: 'Username exists' });
    });
    expect(await screen.findByText('用户名已被使用')).toBeInTheDocument();
  });

  it('stores session and notifies after successful login', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    authServiceMock.login.mockResolvedValueOnce({
      accessToken: 'access-token',
      user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
    });

    render(
      <AuthModal defaultMode="login" onAuthenticated={onAuthenticated} onOpenChange={vi.fn()} open />,
    );

    await user.type(screen.getByLabelText('邮箱'), 'user@example.com');
    await user.type(screen.getByLabelText('密码'), 'password1');
    await user.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());
    expect(useAuthStore.getState().accessToken).toBe('access-token');
  });
});
