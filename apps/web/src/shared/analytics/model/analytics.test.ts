import { describe, expect, it } from 'vitest';

import {
  isAnalyticsExcludedPath,
  isAnalyticsInteractivePath,
  parseConsentRecord,
} from './analytics';

describe('analytics consent model', () => {
  it('accepts only the current, complete consent record', () => {
    expect(
      parseConsentRecord(
        JSON.stringify({
          choice: 'granted',
          updatedAt: '2026-08-01T08:00:00.000Z',
          version: '1',
        }),
        '1',
      ),
    ).toEqual({
      choice: 'granted',
      updatedAt: '2026-08-01T08:00:00.000Z',
      version: '1',
    });
    expect(parseConsentRecord('{broken', '1')).toBeNull();
    expect(
      parseConsentRecord(
        JSON.stringify({
          choice: 'granted',
          updatedAt: '2026-08-01T08:00:00.000Z',
          version: '0',
        }),
        '1',
      ),
    ).toBeNull();
  });

  it('prompts only on interactive routes and always excludes legal and print routes', () => {
    expect(isAnalyticsInteractivePath('/local')).toBe(true);
    expect(isAnalyticsInteractivePath('/resumes/id/edit')).toBe(true);
    expect(isAnalyticsInteractivePath('/')).toBe(false);
    expect(isAnalyticsExcludedPath('/legal/privacy')).toBe(true);
    expect(isAnalyticsExcludedPath('/print/resumes/id')).toBe(true);
  });
});
