import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('renders the current landing content and callbacks', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    const onGuest = vi.fn();
    const onRegister = vi.fn();
    const onViewExample = vi.fn();

    render(
      <HomePage
        currentUser={null}
        onGuest={onGuest}
        onLogin={onLogin}
        onRegister={onRegister}
        onViewExample={onViewExample}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: /LittleAgResume/ })).toBeInTheDocument();
    expect(screen.getAllByText('一个用爱发电的开源项目')).toHaveLength(2);
    expect(screen.getByText('不知道写点什么...祝大家天天开心，找工作顺利吧～')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '登录' }));
    expect(onLogin).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '进入游客模式' }));
    expect(onGuest).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '免费开始' }));
    expect(onRegister).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '顶部免费开始' }));
    expect(onRegister).toHaveBeenCalledTimes(2);
    expect(onViewExample).not.toHaveBeenCalled();
  });

  it('keeps mobile layout constrained and dialog entry points available at 375px', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });

    render(
      <HomePage
        currentUser={null}
        onGuest={vi.fn()}
        onLogin={vi.fn()}
        onRegister={vi.fn()}
        onViewExample={vi.fn()}
      />,
    );

    expect(screen.getByTestId('home-page')).toHaveClass('overflow-x-hidden');
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入游客模式' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '免费开始' })).toBeInTheDocument();
  });
});
