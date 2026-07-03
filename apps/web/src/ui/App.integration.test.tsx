import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/store/auth.store';

import { AppRoutes } from './App';

const authServiceMock = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  register: vi.fn(),
}));

vi.mock('@/services/auth.service', () => ({
  authService: authServiceMock,
}));

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('app auth flow integration', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    authServiceMock.login.mockReset();
    authServiceMock.logout.mockReset();
    authServiceMock.refresh.mockReset();
    authServiceMock.register.mockReset();
    authServiceMock.refresh.mockRejectedValue(new Error('no session'));
  });

  it('renders unauthenticated home after failed bootstrap', async () => {
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: /VegaResume/ })).toBeInTheDocument();
  });

  it('registers from home and lands on console', async () => {
    const user = userEvent.setup();
    authServiceMock.register.mockResolvedValueOnce({
      accessToken: 'access-token',
      user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
    });

    renderApp('/');

    await user.click(await screen.findByRole('button', { name: '免费开始' }));
    await user.type(screen.getByLabelText('用户名'), 'zhangsan');
    await user.type(screen.getByLabelText('邮箱'), 'user@example.com');
    await user.type(screen.getByLabelText('密码'), 'password1');
    await user.type(screen.getByLabelText('确认密码'), 'password1');
    await user.click(screen.getByRole('button', { name: '创建账号' }));

    expect(await screen.findByText('zhangsan')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('logs in from home and lands on console', async () => {
    const user = userEvent.setup();
    authServiceMock.login.mockResolvedValueOnce({
      accessToken: 'access-token',
      user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
    });

    renderApp('/');

    await user.click(await screen.findByRole('button', { name: '登录' }));
    await user.type(screen.getByLabelText('邮箱'), 'user@example.com');
    await user.type(screen.getByLabelText('密码'), 'password1');
    await user.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('zhangsan')).toBeInTheDocument();
  });

  it('restores a refresh-cookie session on console', async () => {
    authServiceMock.refresh.mockResolvedValueOnce({
      accessToken: 'access-token',
      user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
    });

    renderApp('/console');

    expect(await screen.findByText('zhangsan')).toBeInTheDocument();
  });

  it('logs out and returns to home', async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setSession({
      accessToken: 'access-token',
      user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
    });
    authServiceMock.logout.mockResolvedValueOnce(undefined);

    renderApp('/console');

    await user.click(await screen.findByRole('button', { name: '退出登录' }));
    expect(await screen.findByRole('heading', { level: 1, name: /VegaResume/ })).toBeInTheDocument();
  });

  it('redirects authenticated home visits and protects console failures', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'access-token',
      user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
    });

    const { unmount } = renderApp('/');
    expect(await screen.findByText('zhangsan')).toBeInTheDocument();
    unmount();

    useAuthStore.getState().reset();
    authServiceMock.refresh.mockRejectedValueOnce(new Error('no session'));
    renderApp('/console');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /VegaResume/ })).toBeInTheDocument(),
    );
  });
});
