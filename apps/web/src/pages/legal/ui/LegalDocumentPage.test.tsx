import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LegalDocumentPage } from './LegalDocumentPage';

describe('LegalDocumentPage', () => {
  it('renders the selected document and contact channel', () => {
    render(<LegalDocumentPage documentKey="privacy" />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'LittleAgResume 隐私政策' }),
    ).toBeVisible();
    expect(screen.getByText('腾讯云计算（北京）有限责任公司')).toBeVisible();
    expect(screen.getByRole('link', { name: 'littleag_resume@163.com' })).toHaveAttribute(
      'href',
      'mailto:littleag_resume@163.com',
    );
  });
});
