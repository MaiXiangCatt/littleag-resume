## Context

LittleAgResume is currently a monorepo with a Vite React frontend under `apps/web/`, a Go service under `apps/server/`, an empty OpenAPI contract directory under `contracts/openapi/`, and OpenSpec configured as `schema: spec-driven`. The current frontend still renders a Vite starter page, and the backend `apps/server/cmd/api/main.go` only prints a message.

This change implements the first real Home Page and authentication MVP. The approved Full workflow documents split the work into five modules:

1. `contract-tooling-foundation`
2. `server-auth-core`
3. `web-auth-shell`
4. `home-page-ui`
5. `integration-auth-flow`

The implementation must stay contract-driven: OpenSpec artifacts define the change, `contracts/openapi/openapi.yaml` is the source API contract, and `make generate` must synchronize frontend and backend generated interfaces.

## Goals / Non-Goals

**Goals:**

- Define authentication API behavior in OpenAPI for register, login, me, refresh, and logout.
- Establish shared API response and error semantics using `{ code, message, data }`.
- Add PostgreSQL-backed users and refresh token persistence.
- Add bcrypt password storage, Access Token issuance, Refresh Token rotation, logout revocation, account lockout, and global IP rate limiting.
- Add frontend authentication state, AuthModal, Home Page, minimal Console page, and route guards.
- Keep module boundaries clear enough for `vega-implementation` to complete modules one by one.

**Non-Goals:**

- Full Console business functionality.
- Resume editor, template list, export, upload, email verification, password recovery, and account deletion.
- Distributed rate limiting or multi-instance lockout state.
- Changes to `packages/vega-cli/` or the Vega Harness state machine.

## Decisions

### Decision 1: Use one main OpenSpec change with module-grouped tasks

The change spans contract, backend, frontend, UI, and integration work, but the capabilities are tightly coupled by the same authentication flow. A single OpenSpec change named `home-page-auth` keeps requirements and validation coherent while module grouping in `tasks.md` preserves implementation order.

Alternative considered: separate changes per module. That would reduce individual change size but increase contract drift risk across modules.

### Decision 2: Use `contracts/openapi/openapi.yaml`

The OpenAPI contract path SHALL be `contracts/openapi/openapi.yaml`. The current `Makefile` references `../../contracts/openapi.yaml`; `contract-tooling-foundation` must update that path and add generation configuration.

Alternative considered: keep root-level `contracts/openapi.yaml`. That conflicts with the existing directory boundary and repository guidance that contract files live under `contracts/openapi/`.

### Decision 3: Use lightweight backend layering with GORM

The backend will use Gin, GORM, the GORM PostgreSQL driver, and hand-written repositories backed by GORM. Database schema creation SHALL run through GORM `AutoMigrate` from model definitions. PostgreSQL indexes that GORM cannot express portably, such as active-record partial unique indexes, SHALL be created by a repository migration helper using GORM's SQL execution APIs rather than standalone migration files.

Alternative considered: keep `database/sql` with standalone SQL migration files. That is explicit, but it splits schema truth between SQL files and Go models. GORM keeps schema, migration, and database operations in one backend data layer while avoiding an additional sqlc-style generator.

### Decision 4: Store refresh token hashes only

Refresh Tokens SHALL be generated as secure random values, sent only via HttpOnly cookie, and stored server-side as hashes. Each successful refresh revokes the previous token and stores a new hash.

Alternative considered: store raw refresh tokens. That is simpler but increases risk if the database is leaked.

### Decision 5: Keep Access Token only in frontend memory

The frontend auth store keeps `accessToken`, `user`, and auth status in memory. It does not persist Access Token to localStorage or sessionStorage. Session restoration uses `/api/auth/refresh` with the HttpOnly Refresh Token cookie.

Alternative considered: localStorage Access Token. It is easier to implement but contradicts the approved double-token design and increases exposure to XSS token theft.

## Module Design

### contract-tooling-foundation

Primary paths:

- `contracts/openapi/openapi.yaml`
- `openspec/`
- `Makefile`
- `docs/designAndPrd/api_response_and_error_codes.md`
- `apps/web/package.json`
- `apps/web/orval.config.ts`
- `apps/web/src/shared/api/generated/`
- `apps/server/oapi-codegen.yaml`
- `apps/server/internal/generated/`
- `apps/web/src/index.css`

Responsibilities:

- Define `BaseResponse`, `AuthUser`, request schemas, response schemas, cookies, and error responses in OpenAPI.
- Add auth endpoints:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
- Update numeric errors:
  - `101007 ErrUsernameExists`
  - `101008 ErrUsernameFormatInvalid`
  - `101009 ErrAccountLocked`
  - `101010 ErrRefreshTokenInvalid`
- Configure `make generate` to use `contracts/openapi/openapi.yaml`.
- Configure frontend and backend generated output directories.
- Add frontend dependencies and base styling/tooling required by later UI modules.

### server-auth-core

Primary paths:

- `apps/server/go.mod`
- `apps/server/cmd/api/main.go`
- `apps/server/config.yaml`
- `apps/server/internal/model/`
- `apps/server/internal/repository/`
- `apps/server/internal/service/`
- `apps/server/internal/handler/`
- `apps/server/internal/middleware/rate_limit.go`

Responsibilities:

- Build Gin API server and register auth routes.
- Implement `BaseResponse`, `AppError`, and auth DTO/model types.
- Add users and refresh_tokens GORM model migrations.
- Implement user and refresh token repositories using GORM.
- Implement auth service for register, login, me, refresh, logout, lockout, token signing, and token verification.
- Implement handler tests and service/repository tests.

Data model:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX users_email_active_uidx
  ON users (email_normalized)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX users_username_active_uidx
  ON users (username)
  WHERE deleted_at IS NULL;

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  replaced_by_token_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### web-auth-shell

Primary paths:

- `apps/web/src/shared/auth/model/`
- `apps/web/src/shared/auth/store/`
- `apps/web/src/shared/auth/hooks/useAuth.ts`
- `apps/web/src/shared/auth/hooks/useAuthBootstrap.ts`
- `apps/web/src/shared/auth/hooks/useHomeGuard.ts`
- `apps/web/src/shared/http/http.client.ts`
- `apps/web/src/shared/auth/api/auth.service.ts`
- `apps/web/src/pages/console/ui/`
- `apps/web/src/pages/home/ui/components/AuthModal/`

Responsibilities:

- Define frontend `AuthUser` with `id`, `username`, and `email`.
- Implement `auth.store` with in-memory Access Token and auth status.
- Implement `http.client` that parses `{ code, message, data }`, injects Authorization, includes credentials for refresh/logout, and performs a single refresh retry for expired/invalid Access Token.
- Implement `auth.service` around generated OpenAPI client.
- Implement AuthModal login/register forms with zod validation.
- Implement minimal Console page that displays current user information.

### home-page-ui

Primary paths:

- `apps/web/src/shared/layout/AppHeader/`
- `apps/web/src/pages/home/ui/HomePage.tsx`
- `apps/web/src/pages/home/ui/components/HeroSection/`
- `apps/web/src/pages/home/ui/components/FeaturesSection/`
- `apps/web/src/pages/home/ui/components/Footer/`
- `apps/web/src/pages/home/ui/components/ExamplePreview/`

Responsibilities:

- Render Home Page sections and copy from the PRD.
- Implement sticky AppHeader with `actions` slot and logged-in user menu surface.
- Render Hero placeholder resume preview.
- Keep "查看示例" in-page by focusing or scrolling to ExamplePreview.
- Maintain responsive layout without horizontal overflow at 375px.

### integration-auth-flow

Primary paths:

- `apps/web/src/main.tsx`
- `apps/web/src/app/App.tsx`
- `apps/web/vite.config.ts`
- `apps/web/e2e/`
- `apps/web/src/**/*.integration.test.tsx`

Responsibilities:

- Mount React Router.
- Connect Home Page callbacks to AuthModal.
- Connect Home guard, Console guard, auth bootstrap, and logout behavior.
- Configure Vite proxy or CORS/credentials strategy for local development.
- Add end-to-end or integration coverage for register, login, refresh, logout, home redirect, and Console guard.

## API and Contract Shape

All responses use `BaseResponse`.

`AuthUser`:

```json
{
  "id": "uuid",
  "username": "张三",
  "email": "user@example.com"
}
```

`POST /api/auth/register` request:

```json
{
  "username": "张三",
  "email": "user@example.com",
  "password": "password1",
  "confirmPassword": "password1"
}
```

`POST /api/auth/login` request:

```json
{
  "email": "user@example.com",
  "password": "password1"
}
```

`POST /api/auth/register`, `POST /api/auth/login`, and `POST /api/auth/refresh` response data:

```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "<uuid>",
    "username": "张三",
    "email": "user@example.com"
  }
}
```

`GET /api/auth/me` response data:

```json
{
  "user": {
    "id": "<uuid>",
    "username": "张三",
    "email": "user@example.com"
  }
}
```

`POST /api/auth/logout` returns an empty success response and clears the refresh cookie.

## Risks / Trade-offs

- [Risk] Refresh Token rotation can race under concurrent refresh requests. → [Mitigation] Implement refresh in a database transaction and allow only one active token rotation to succeed.
- [Risk] In-memory IP and account lockout state does not work across multiple server instances. → [Mitigation] Treat this as an explicit MVP boundary and keep multi-instance protection out of scope.
- [Risk] Frontend and backend generation setup is missing today. → [Mitigation] Put all generation configuration and Makefile path fixes in `contract-tooling-foundation` before feature implementation.
- [Risk] Adding Tailwind, shadcn/ui, form libraries, router, and Zustand at once can destabilize the frontend build. → [Mitigation] Foundation module validates build/lint after dependency and config changes.
- [Risk] Cookie behavior differs between local dev and production. → [Mitigation] Integration module owns Vite proxy/CORS and credentialed request verification.

## Migration Plan

1. Create the OpenAPI contract and generation foundation.
2. Implement backend authentication using the generated contract and GORM migrations.
3. Implement frontend auth shell and Home UI in parallel after foundation.
4. Integrate routing, proxy/CORS, and end-to-end flow.
5. Run `make generate`, `make test-web`, `make test-server`, `make e2e`, `make lint`, and `make build`.

Rollback strategy:

- This is new functionality on a skeleton app. If a module fails, keep the Vega module pending and do not mark it complete.
- Revert generated contract/config changes as a unit if contract generation cannot be stabilized.
- Refresh token persistence is introduced by the GORM schema migration; production rollback would require disabling auth routes before rolling back database changes.

## Open Questions

- The default global IP rate limit threshold should be chosen during implementation and documented in `apps/server/config.yaml`.
- The local development proxy versus CORS approach should be finalized in `integration-auth-flow` based on the chosen dev server ports.
- AuthModal may be lazy-loaded if bundle size becomes a concern; this does not affect API or behavior requirements.
