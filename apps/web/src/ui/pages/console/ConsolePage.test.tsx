import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/store/auth.store';

import { ConsolePage } from './ConsolePage';

describe('ConsolePage', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
  });

  it('shows current-user loading state', () => {
    useAuthStore.getState().setLoading();

    render(<ConsolePage />);

    expect(screen.getByText('正在加载账号信息')).toBeInTheDocument();
  });

  it('renders the authenticated user summary', () => {
    useAuthStore.getState().setSession({
      accessToken: 'access-token',
      user: { id: 'user-id', username: 'zhangsan', email: 'user@example.com' },
    });

    render(<ConsolePage />);

    expect(screen.getByText('zhangsan')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });
});
