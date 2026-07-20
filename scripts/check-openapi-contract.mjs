import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

const checks = [];

function fileText(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    checks.push(`Missing ${path}`);
    return '';
  }
  return readFileSync(absolute, 'utf8');
}

function expectIncludes(label, text, fragments) {
  for (const fragment of fragments) {
    if (!text.includes(fragment)) {
      checks.push(`${label} must include ${fragment}`);
    }
  }
}

const openapi = fileText('contracts/openapi/openapi.yaml');
const makefile = fileText('Makefile');
const orvalConfig = fileText('apps/web/orval.config.ts');
const oapiConfig = fileText('apps/server/oapi-codegen.yaml');

expectIncludes('OpenAPI contract', openapi, [
  'openapi: 3.0.3',
  '/api/auth/register:',
  '/api/auth/login:',
  '/api/auth/me:',
  '/api/auth/refresh:',
  '/api/auth/logout:',
  'BaseResponse:',
  'AuthUser:',
  'RegisterRequest:',
  'LoginRequest:',
  'AuthPayload:',
  'name: refresh_token',
  'bearerAuth:',
  'ErrUsernameExists',
  'ErrUsernameFormatInvalid',
  'ErrAccountLocked',
  'ErrRefreshTokenInvalid',
]);

expectIncludes('Makefile', makefile, [
  'pnpm --filter web gen:api',
  'go tool oapi-codegen',
  '../../contracts/openapi/openapi.yaml',
]);

expectIncludes('orval config', orvalConfig, [
  '../../contracts/openapi/openapi.yaml',
  'src/shared/api/generated',
]);

expectIncludes('oapi-codegen config', oapiConfig, [
  'internal/generated',
]);

if (checks.length > 0) {
  console.error(checks.map((check) => `- ${check}`).join('\n'));
  process.exit(1);
}

console.log('OpenAPI contract and generation config are consistent.');
