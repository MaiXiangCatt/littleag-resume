import { Font } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';

import './ResumePdfDocument';

describe('ResumePdfDocument font registration', () => {
  it.each([
    ['NotoSansSC', '/fonts/NotoSansSC-Pdf-Regular.ttf', '/fonts/NotoSansSC-Pdf-Bold.ttf'],
    ['NotoSerifSC', '/fonts/NotoSerifSC-Pdf-Regular.ttf', '/fonts/NotoSerifSC-Pdf-Bold.ttf'],
  ])('registers distinct static regular and bold sources for %s', (family, regular, bold) => {
    const sources = Font.getRegisteredFonts()[family].sources.filter(
      (source) => source.fontStyle === 'normal',
    );

    expect(sources.find((source) => source.fontWeight === 400)?.src).toBe(regular);
    expect(sources.find((source) => source.fontWeight === 700)?.src).toBe(bold);
    expect(regular).not.toBe(bold);
  });
});
