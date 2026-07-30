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
      <AuthModal
        defaultMode="register"
        onAuthenticated={vi.fn()}
        onOpenChange={vi.fn()}
        open
        registrationMode="open"
      />,
    );

    expect(screen.getByRole('tab', { name: '注册' })).toHaveAttribute('aria-selected', 'true');

    rerender(
      <AuthModal
        defaultMode="login"
        onAuthenticated={vi.fn()}
        onOpenChange={vi.fn()}
        open
        registrationMode="open"
      />,
    );
    expect(screen.getByRole('tab', { name: '登录' })).toHaveAttribute('aria-selected', 'true');
  });

  it('validates registration fields before submitting', async () => {
    const user = userEvent.setup();
    render(
      <AuthModal
        defaultMode="register"
        onAuthenticated={vi.fn()}
        onOpenChange={vi.fn()}
        open
        registrationMode="open"
      />,
    );

    await user.click(screen.getByRole('button', { name: '发送验证码' }));

    expect(await screen.findByText('请输入有效邮箱')).toBeInTheDocument();
    expect(authServiceMock.register).not.toHaveBeenCalled();
  });

  it('requires both agreements before sending a registration code', async () => {
    const user = userEvent.setup();
    render(
      <AuthModal
        defaultMode="register"
        onAuthenticated={vi.fn()}
        onOpenChange={vi.fn()}
        open
        registrationMode="open"
      />,
    );

    expect(screen.getByRole('link', { name: '《用户服务协议及内容规则》' })).toHaveAttribute(
      'href',
      '/legal/terms',
    );
    expect(screen.getByRole('link', { name: '《隐私政策》' })).toHaveAttribute(
      'href',
      '/legal/privacy',
    );
    expect(screen.getByRole('link', { name: '《个人信息跨境处理说明》' })).toHaveAttribute(
      'href',
      '/legal/cross-border',
    );

    await user.type(screen.getByLabelText('邮箱'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: '发送验证码' }));

    expect(await screen.findByText('请先阅读并勾选两项协议')).toBeInTheDocument();
    expect(authServiceMock.sendRegistrationEmailVerification).not.toHaveBeenCalled();

    await acceptRegistrationAgreements(user);
    authServiceMock.sendRegistrationEmailVerification.mockResolvedValueOnce({
      email: 'user@example.com',
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    await user.click(screen.getByRole('button', { name: '发送验证码' }));

    await waitFor(() =>
      expect(authServiceMock.sendRegistrationEmailVerification).toHaveBeenCalledWith(
        'user@example.com',
        '',
      ),
    );
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
      <AuthModal
        defaultMode="register"
        onAuthenticated={vi.fn()}
        onOpenChange={vi.fn()}
        open
        registrationMode="open"
      />,
    );

    await user.type(screen.getByLabelText('邮箱'), 'user@example.com');
    await acceptRegistrationAgreements(user);
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

  it('requires and preserves the invitation code in invite mode', async () => {
    const user = userEvent.setup();
    authServiceMock.sendRegistrationEmailVerification.mockResolvedValue({
      email: 'first@example.com',
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    render(
      <AuthModal
        defaultMode="register"
        onAuthenticated={vi.fn()}
        onOpenChange={vi.fn()}
        open
        registrationMode="invite"
      />,
    );

    expect(screen.getByRole('button', { name: '发送验证码' })).toBeDisabled();
    await user.type(screen.getByLabelText('邀请码'), 'ABCD-EFGH-JKLM-NPQR');
    await user.type(screen.getByLabelText('邮箱'), 'first@example.com');
    await acceptRegistrationAgreements(user);
    await user.click(screen.getByRole('button', { name: '发送验证码' }));

    await waitFor(() =>
      expect(authServiceMock.sendRegistrationEmailVerification).toHaveBeenCalledWith(
        'first@example.com',
        'ABCD-EFGH-JKLM-NPQR',
      ),
    );
    await user.clear(screen.getByLabelText('邮箱'));
    await user.type(screen.getByLabelText('邮箱'), 'second@example.com');
    expect(screen.getByLabelText('邀请码')).toHaveValue('ABCD-EFGH-JKLM-NPQR');
  });

  it('keeps login available while closed mode hides the registration form', async () => {
    const user = userEvent.setup();
    render(
      <AuthModal
        defaultMode="register"
        onAuthenticated={vi.fn()}
        onOpenChange={vi.fn()}
        open
        registrationMode="closed"
      />,
    );

    expect(screen.getByText('注册暂未开放，已有账号仍可正常登录。')).toBeInTheDocument();
    expect(screen.queryByLabelText('邮箱')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '登录' }));
    expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
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
        registrationMode="open"
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
        registrationMode="open"
      />,
    );

    await user.type(screen.getByLabelText('邮箱'), 'user@example.com');
    await acceptRegistrationAgreements(user);
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
        invitationCode: '',
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

    render(
      <AuthModal
        defaultMode="login"
        onAuthenticated={vi.fn()}
        onOpenChange={vi.fn()}
        open
        registrationMode="open"
      />,
    );

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

async function acceptRegistrationAgreements(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('checkbox', { name: '同意用户服务协议及内容规则和隐私政策' }));
  await user.click(screen.getByRole('checkbox', { name: '单独同意个人信息跨境处理说明' }));
}
