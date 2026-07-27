## Why

LittleAgResume currently still serves a Vite starter page and has no real authentication API, so users cannot complete the intended homepage conversion flow from product discovery to registration and Console entry. This change establishes the first contract-driven full-stack authentication MVP needed for the Home Page PRD.

## What Changes

- Replace the starter-page behavior with a real Home Page entry flow for unauthenticated users.
- Add a minimal `/console` authenticated landing page.
- Add a Home Page AuthModal flow for registration and login.
- Introduce real authentication APIs for register, login, current user lookup, token refresh, and logout.
- Introduce PostgreSQL-backed users and refresh tokens with bcrypt password storage.
- Use Access Token plus Refresh Token authentication: 15-minute Access Token in frontend memory, 7-day Refresh Token in an HttpOnly cookie, and server-side refresh token hash persistence.
- Rotate Refresh Token on every successful refresh.
- Add global IP in-memory rate limiting and account-level login failure lockout.
- Add or update OpenAPI generation so frontend and backend share one contract at `contracts/openapi/openapi.yaml`.
- Update numeric authentication error codes for username and refresh/lockout cases.
- Organize the Full workflow implementation around these modules:
  - `contract-tooling-foundation`
  - `server-auth-core`
  - `web-auth-shell`
  - `home-page-ui`
  - `integration-auth-flow`

No breaking API changes are introduced because the project does not yet have an existing authentication API contract.

## Capabilities

### New Capabilities

- `auth-account-api`: Covers registration, login, authenticated current-user lookup, logout, user identity fields, validation, persistence, and unified API responses.
- `auth-session-security`: Covers Access/Refresh Token behavior, refresh token rotation, cookie handling, token invalidation, global IP rate limiting, and account lockout.
- `home-page-auth-experience`: Covers the Home Page, AuthModal, authenticated route guards, minimal Console landing page, responsive behavior, and user-facing auth flow.

### Modified Capabilities

- None. There are no existing OpenSpec specs for these behaviors in this repository.

## Impact

- OpenAPI and generation:
  - `contracts/openapi/openapi.yaml`
  - `Makefile`
  - `apps/web/orval.config.ts`
  - `apps/web/src/shared/api/generated/`
  - `apps/server/oapi-codegen.yaml`
  - `apps/server/internal/generated/`
- Documentation:
  - `docs/designAndPrd/api_response_and_error_codes.md`
- Frontend:
  - `apps/web/package.json`
  - `apps/web/src/index.css`
  - `apps/web/src/main.tsx`
  - `apps/web/src/app/App.tsx`
  - `apps/web/src/shared/auth/model/`
  - `apps/web/src/shared/auth/store/`
  - `apps/web/src/shared/auth/hooks/`
  - `apps/web/src/shared/http/`
  - `apps/web/src/shared/auth/api/`
  - `apps/web/src/shared/layout/AppHeader/`
  - `apps/web/src/pages/home/ui/`
  - `apps/web/src/pages/console/ui/`
  - `apps/web/vite.config.ts`
  - frontend unit, integration, or e2e test paths
- Backend:
  - `apps/server/go.mod`
  - `apps/server/cmd/api/main.go`
  - `apps/server/config.yaml`
  - `apps/server/internal/model/`
  - `apps/server/internal/repository/`
  - `apps/server/internal/service/`
  - `apps/server/internal/handler/`
  - `apps/server/internal/middleware/`
- Validation commands expected during implementation and verification:
  - `make spec-check`
  - `make generate`
  - `make test-web`
  - `make test-server`
  - `make e2e`
  - `make lint`
  - `make build`
