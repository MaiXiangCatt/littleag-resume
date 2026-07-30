export const LEGAL_ROUTES = {
  crossBorder: '/legal/cross-border',
  privacy: '/legal/privacy',
  terms: '/legal/terms',
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_ROUTES;
