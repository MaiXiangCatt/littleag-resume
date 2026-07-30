import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Footer } from './Footer';

const authServiceMock = vi.hoisted(() => ({
  answerInvitationChallenge: vi.fn(),
  getInvitationChallenge: vi.fn(),
}));

vi.mock('@/shared/auth/api/auth.service', () => ({
  authService: authServiceMock,
}));

describe('Footer invitation challenge', () => {
  beforeEach(() => {
    authServiceMock.answerInvitationChallenge.mockReset();
    authServiceMock.getInvitationChallenge.mockReset();
  });

  it('reveals the challenge after nine adjacent Ag clicks and completes the flow', async () => {
    const user = userEvent.setup();
    const onRegister = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    authServiceMock.getInvitationChallenge.mockResolvedValue({
      challengeId: 'yi-ci-lin-qing',
      prompt: '异次临倾，',
    });
    authServiceMock.answerInvitationChallenge
      .mockRejectedValueOnce({ code: 101016 })
      .mockResolvedValueOnce({
        expiresInSeconds: 1800,
        invitationCode: 'ABCD-EFGH-JKLM-NPQR',
      });

    render(
      <Footer
        onRegister={onRegister}
        registrationPolicy={{ challengeAvailable: true, mode: 'invite' }}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Ag' });
    for (let click = 0; click < 9; click += 1) {
      fireEvent.click(trigger);
    }

    expect(await screen.findByText('异次临倾，')).toBeInTheDocument();
    await user.type(screen.getByLabelText('接下一句'), '步步唯银');
    await user.click(screen.getByRole('button', { name: '对暗号' }));
    expect(await screen.findByText('暗号不正确')).toBeInTheDocument();
    expect(screen.getByText('异次临倾，')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '对暗号' }));

    expect(await screen.findByDisplayValue('ABCD-EFGH-JKLM-NPQR')).toBeInTheDocument();
    expect(screen.getByText('30 分钟内有效，注册成功后立即失效。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '复制邀请码' }));
    expect(writeText).toHaveBeenCalledWith('ABCD-EFGH-JKLM-NPQR');

    await user.click(screen.getByRole('button', { name: '去注册' }));
    expect(onRegister).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('resets the count when adjacent clicks are more than 1.5 seconds apart', async () => {
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    authServiceMock.getInvitationChallenge.mockResolvedValue({
      challengeId: 'shan-se-you-wu-zhong',
      prompt: '山色有无中，',
    });
    render(
      <Footer
        onRegister={vi.fn()}
        registrationPolicy={{ challengeAvailable: true, mode: 'open' }}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Ag' });

    for (let click = 0; click < 8; click += 1) {
      fireEvent.click(trigger);
    }
    now += 1_501;
    fireEvent.click(trigger);
    expect(authServiceMock.getInvitationChallenge).not.toHaveBeenCalled();

    for (let click = 0; click < 8; click += 1) {
      fireEvent.click(trigger);
    }
    await waitFor(() => expect(authServiceMock.getInvitationChallenge).toHaveBeenCalledTimes(1));
    vi.restoreAllMocks();
  });

  it('shows registration paused without requesting a challenge in closed mode', async () => {
    render(
      <Footer
        onRegister={vi.fn()}
        registrationPolicy={{ challengeAvailable: false, mode: 'closed' }}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Ag' });
    for (let click = 0; click < 9; click += 1) {
      fireEvent.click(trigger);
    }

    expect(await screen.findByText(/注册暂未开放/)).toBeInTheDocument();
    expect(authServiceMock.getInvitationChallenge).not.toHaveBeenCalled();
  });
});
