import { describe, expect, it } from 'vitest';

import { createPdfTextBreaks } from './resume.pdf-text';

describe('createPdfTextBreaks', () => {
  it('adds zero-width break opportunities between CJK characters', () => {
    expect(createPdfTextBreaks('一段很长的描述1111')).toEqual([
      '一',
      '',
      '段',
      '',
      '很',
      '',
      '长',
      '',
      '的',
      '',
      '描',
      '',
      '述',
      '',
      '1',
      '',
      '1',
      '',
      '1',
      '',
      '1',
      '',
    ]);
  });

  it('keeps Latin text inside mixed CJK content together', () => {
    expect(createPdfTextBreaks('负责React开发')).toEqual([
      '负',
      '',
      '责',
      '',
      'React',
      '',
      '开',
      '',
      '发',
      '',
    ]);
  });

  it('keeps ordinary space-delimited words intact', () => {
    expect(createPdfTextBreaks('frontend')).toEqual(['frontend']);
  });

  it('allows a standalone numeric sequence to fill the remaining line', () => {
    expect(createPdfTextBreaks('23333333')).toEqual([
      '2',
      '',
      '3',
      '',
      '3',
      '',
      '3',
      '',
      '3',
      '',
      '3',
      '',
      '3',
      '',
      '3',
      '',
    ]);
  });
});
