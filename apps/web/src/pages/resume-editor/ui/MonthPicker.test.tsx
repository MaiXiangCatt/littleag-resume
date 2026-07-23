import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MonthPicker } from './MonthPicker';

describe('MonthPicker', () => {
  it('selects a month while preserving the YYYY-MM contract', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<MonthPicker ariaLabel="开始时间" onValueChange={onValueChange} value="2025-06" />);

    expect(screen.getByRole('button', { name: '开始时间' })).toHaveTextContent('2025 年 06 月');

    await user.click(screen.getByRole('button', { name: '开始时间' }));
    await user.click(screen.getByRole('button', { name: '2025 年 7 月' }));

    expect(onValueChange).toHaveBeenCalledWith('2025-07');
  });

  it('navigates between years without mutating the value', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<MonthPicker ariaLabel="结束时间" onValueChange={onValueChange} value="2025-06" />);

    await user.click(screen.getByRole('button', { name: '结束时间' }));
    await user.click(screen.getByRole('button', { name: '下一年' }));

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '2026 年 1 月' })).toBeInTheDocument();
  });
});
