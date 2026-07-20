import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/shared/ui/button';

import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  it('renders the actions slot and sticky surface', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();

    render(
      <AppHeader
        actions={<Button onClick={onLogin}>登录</Button>}
        currentUser={null}
      />,
    );

    expect(screen.getByRole('banner')).toHaveClass('sticky');
    await user.click(screen.getByRole('button', { name: '登录' }));
    expect(onLogin).toHaveBeenCalled();
  });

  it('shows a logged-in user menu surface', () => {
    render(
      <AppHeader
        actions={null}
        currentUser={{ id: 'user-id', username: 'zhangsan', email: 'user@example.com' }}
      />,
    );

    expect(screen.getByText('zhangsan')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });
});
