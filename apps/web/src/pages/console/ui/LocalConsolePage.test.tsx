import 'fake-indexeddb/auto';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_RESUME_LIMIT } from '@/pages/resume-editor/model/local-resume';
import { localResumeStore } from '@/pages/resume-editor/store/local-resume.store';
import { useAuthStore } from '@/shared/auth/store/auth.store';

import { LocalConsolePage } from './ConsolePage';

describe('LocalConsolePage', () => {
  beforeEach(async () => {
    await localResumeStore.clear();
    useAuthStore.getState().reset();
  });

  it('shows local-only navigation without an account menu', async () => {
    const onLogin = vi.fn();

    render(
      <MemoryRouter>
        <LocalConsolePage onLogin={onLogin} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '我的简历' })).toBeInTheDocument();
    expect(screen.getByText('仅存此浏览器')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录 / 注册' })).toBeInTheDocument();
    expect(screen.queryByLabelText('账号菜单')).not.toBeInTheDocument();
  });

  it('disables only creation actions after reaching the 20 resume limit', async () => {
    const user = userEvent.setup();
    for (let index = 0; index < LOCAL_RESUME_LIMIT; index += 1) {
      await localResumeStore.create(`本地简历 ${index + 1}`);
    }

    render(
      <MemoryRouter>
        <LocalConsolePage onLogin={vi.fn()} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('暂不可新建')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /暂不可新建/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '已达 20 份上限' })).toBeDisabled();

    await user.click(screen.getAllByRole('button', { name: /更多操作/ })[0]);
    expect(screen.getByRole('menuitem', { name: '复制简历' })).toHaveAttribute('data-disabled');
    expect(screen.getByRole('menuitem', { name: '重命名' })).not.toHaveAttribute('data-disabled');
    expect(screen.getAllByRole('button', { name: '删除' })[0]).toBeEnabled();
  });
});
