import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('renders the landing sections and callbacks', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    const onRegister = vi.fn();
    const onViewExample = vi.fn();

    render(
      <HomePage
        currentUser={null}
        onLogin={onLogin}
        onRegister={onRegister}
        onViewExample={onViewExample}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: /VegaResume/ })).toBeInTheDocument();
    expect(screen.getByText('用一页好简历，开始下一次机会')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '简历示例预览' })).toBeInTheDocument();
    expect(screen.getAllByTestId('home-feature-card')).toHaveLength(3);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '登录' }));
    expect(onLogin).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '免费开始' }));
    expect(onRegister).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '查看示例' }));
    expect(onViewExample).toHaveBeenCalled();
    expect(screen.getByTestId('example-preview')).toHaveFocus();
  });

  it('keeps mobile layout constrained and dialog entry points available at 375px', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });

    render(
      <HomePage
        currentUser={null}
        onLogin={vi.fn()}
        onRegister={vi.fn()}
        onViewExample={vi.fn()}
      />,
    );

    expect(screen.getByTestId('home-page')).toHaveClass('overflow-x-hidden');
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '免费开始' })).toBeInTheDocument();
  });
});
