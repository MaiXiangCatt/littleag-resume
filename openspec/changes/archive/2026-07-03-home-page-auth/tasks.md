## 1. contract-tooling-foundation

- [x] 1.1 Tests: add or update contract validation checks that fail while `contracts/openapi/openapi.yaml` and generation configs are missing or inconsistent.
- [x] 1.2 Implementation: create `contracts/openapi/openapi.yaml` with `BaseResponse`, `AuthUser`, register/login/me/refresh/logout schemas, cookie metadata, and documented error responses.
- [x] 1.3 Implementation: update `docs/designAndPrd/api_response_and_error_codes.md` with `101007 ErrUsernameExists`, `101008 ErrUsernameFormatInvalid`, `101009 ErrAccountLocked`, and `101010 ErrRefreshTokenInvalid`.
- [x] 1.4 Implementation: update `Makefile`, `apps/web/orval.config.ts`, and `apps/server/oapi-codegen.yaml` so `make generate` reads `contracts/openapi/openapi.yaml`.
- [x] 1.5 Implementation: add frontend dependencies and base style/tooling configuration required by generated clients, Tailwind, shadcn/ui-compatible components, forms, router, and tests.
- [x] 1.6 Verification: run `make spec-check`, `make generate`, `make lint-web`, and `make build-web`, documenting any missing environment dependency that cannot be resolved in this module.

## 2. server-auth-core

- [x] 2.1 Tests: add backend model/service tests for registration validation, duplicate email, duplicate username, password strength, login success, invalid credentials, account lockout, token validation, refresh rotation, and logout revocation.
- [x] 2.2 Tests: add repository tests for GORM AutoMigrate schema, users partial unique indexes, email normalization lookup, refresh token hash lookup, refresh token revoke, and refresh token replacement behavior.
- [x] 2.3 Tests: add handler tests with `httptest` for register, login, me, refresh, logout, unified response envelopes, HTTP status codes, and refresh cookie set/clear behavior.
- [x] 2.4 Implementation: add Gin server wiring, configuration loading, database connection, auth routes, and global IP rate limit middleware.
- [x] 2.5 Implementation: add users and refresh_tokens GORM migrations with active-record unique constraints and refresh token hash persistence.
- [x] 2.6 Implementation: add model, repository, service, and handler layers for register, login, me, refresh, and logout.
- [x] 2.7 Implementation: implement bcrypt password hashing, Access Token signing/validation, Refresh Token generation/hash/rotation/revocation, and account-level failed login lockout.
- [x] 2.8 Verification: run `make test-server`, `make lint-server`, and `make build-server`.

## 3. web-auth-shell

- [x] 3.1 Tests: add frontend tests for auth store state transitions, `http.client` unified response handling, Authorization header injection, credentialed refresh/logout requests, and single refresh retry behavior.
- [x] 3.2 Tests: add AuthModal tests for login/register tab defaults, username/email/password/confirmPassword validation, backend error-code mapping, loading state, and duplicate-submit prevention.
- [x] 3.3 Tests: add Console and auth hook tests for bootstrap success, bootstrap failure, logout, and current-user loading.
- [x] 3.4 Implementation: add `AuthUser`, API error, form models, and validation schemas under `apps/web/src/models/`.
- [x] 3.5 Implementation: add in-memory auth store with Access Token, current user, and status actions under `apps/web/src/store/`.
- [x] 3.6 Implementation: add `services/http.client.ts` and `services/auth.service.ts` using generated OpenAPI client output.
- [x] 3.7 Implementation: add `useAuth`, `useAuthBootstrap`, and `useHomeGuard` hooks.
- [x] 3.8 Implementation: add AuthModal, LoginForm, RegisterForm, and minimal Console page without wiring top-level routing.
- [x] 3.9 Verification: run `make test-web`, `make lint-web`, and `make build-web`.

## 4. home-page-ui

- [x] 4.1 Tests: add Home Page UI tests for AppHeader actions slot, sticky scroll styling, Hero content, placeholder preview, features cards, footer, and example preview action.
- [x] 4.2 Tests: add responsive checks for 375px layout without horizontal overflow and Dialog-compatible entry points.
- [x] 4.3 Implementation: add shared AppHeader UI with actions slot and logged-in user menu surface.
- [x] 4.4 Implementation: add HomePage, HeroSection, ExamplePreview, FeaturesSection, and Footer under `apps/web/src/ui/pages/home/`.
- [x] 4.5 Implementation: ensure Home Page exposes callback props for login, registration, and view-example interactions without owning authentication business logic.
- [x] 4.6 Verification: run `make test-web`, `make lint-web`, and `make build-web`.

## 5. integration-auth-flow

- [x] 5.1 Tests: add integration or e2e coverage for unauthenticated home render, registration to Console, login to Console, refresh-based session restoration, logout, authenticated home redirect, and Console guard failure.
- [x] 5.2 Implementation: replace Vite starter entry with Router mounting in `apps/web/src/main.tsx` and app shell routing in `apps/web/src/ui/App.tsx`.
- [x] 5.3 Implementation: wire HomePage callbacks to AuthModal, auth store, auth bootstrap, Home guard, and Console guard.
- [x] 5.4 Implementation: configure Vite proxy or backend CORS/credentials behavior so Refresh Token cookies work in local development.
- [x] 5.5 Verification: run `make test-web`, `make test-server`, `make e2e`, `make lint`, and `make build`.
- [x] 5.6 Verification: after the module passes, call `vega module complete integration-auth-flow` only when all preceding modules are already completed and the full auth flow is verified.
