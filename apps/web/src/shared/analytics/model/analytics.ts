export type AnalyticsConsentChoice = 'granted' | 'denied';
export type AnalyticsEventName =
  | 'workspace_activated'
  | 'resume_created'
  | 'resume_imported'
  | 'resume_exported_pdf'
  | 'resume_exported_json';
export type AnalyticsMode = 'local' | 'cloud';

export type AnalyticsConsentRecord = {
  choice: AnalyticsConsentChoice;
  updatedAt: string;
  version: string;
};

export function parseConsentRecord(
  value: string | null,
  expectedVersion: string,
): AnalyticsConsentRecord | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('choice' in parsed) ||
      !('updatedAt' in parsed) ||
      !('version' in parsed)
    ) {
      return null;
    }
    const candidate = parsed as Record<string, unknown>;
    if (
      (candidate.choice !== 'granted' && candidate.choice !== 'denied') ||
      candidate.version !== expectedVersion ||
      typeof candidate.updatedAt !== 'string' ||
      Number.isNaN(Date.parse(candidate.updatedAt))
    ) {
      return null;
    }
    return candidate as AnalyticsConsentRecord;
  } catch {
    return null;
  }
}

export function isAnalyticsExcludedPath(pathname: string): boolean {
  return pathname.startsWith('/legal/') || pathname.startsWith('/print/');
}

export function isAnalyticsInteractivePath(pathname: string): boolean {
  return (
    pathname === '/console' ||
    pathname === '/local' ||
    pathname.startsWith('/resumes/') ||
    pathname.startsWith('/local/resumes/')
  );
}
