## ADDED Requirements

### Requirement: Access token handling
The system SHALL issue short-lived Access Tokens for authenticated API access. Access Tokens SHALL expire after 15 minutes and SHALL be sent by the frontend using the `Authorization: Bearer <token>` header.

#### Scenario: Access token issued
- **WHEN** registration, login, or refresh succeeds
- **THEN** the response data contains a new Access Token

#### Scenario: Expired access token
- **WHEN** a protected endpoint receives an expired Access Token
- **THEN** the system rejects the request with `ErrTokenExpired`

### Requirement: Refresh token cookie
The system SHALL issue a Refresh Token through an HttpOnly cookie named `refresh_token`. The Refresh Token SHALL expire after 7 days and SHALL be persisted server-side only as a hash.

#### Scenario: Refresh token cookie set
- **WHEN** registration, login, or refresh succeeds
- **THEN** the system sets an HttpOnly `refresh_token` cookie scoped to authentication endpoints

#### Scenario: Refresh token is not exposed in response body
- **WHEN** registration, login, or refresh succeeds
- **THEN** the response body does not include the Refresh Token plaintext

### Requirement: Refresh token rotation
The system SHALL expose `POST /api/auth/refresh` to exchange a valid Refresh Token cookie for a new Access Token and a rotated Refresh Token. Each successful refresh SHALL revoke the previous Refresh Token.

#### Scenario: Successful refresh
- **WHEN** a client calls `/api/auth/refresh` with a valid active Refresh Token cookie
- **THEN** the system revokes the old Refresh Token, persists a new Refresh Token hash, sets a new Refresh Token cookie, and returns a new Access Token and `AuthUser`

#### Scenario: Reused refresh token
- **WHEN** a client calls `/api/auth/refresh` with a Refresh Token that was already revoked or replaced
- **THEN** the system rejects the request with `ErrRefreshTokenInvalid`

#### Scenario: Missing refresh token
- **WHEN** a client calls `/api/auth/refresh` without the Refresh Token cookie
- **THEN** the system rejects the request with `ErrRefreshTokenInvalid`

### Requirement: Logout revokes current refresh token
The system SHALL expose `POST /api/auth/logout` to revoke the current Refresh Token and clear the Refresh Token cookie.

#### Scenario: Successful logout
- **WHEN** a client calls `/api/auth/logout` with an active Refresh Token cookie
- **THEN** the system revokes that Refresh Token and returns a response that clears the `refresh_token` cookie

#### Scenario: Logout without active refresh token
- **WHEN** a client calls `/api/auth/logout` without an active Refresh Token cookie
- **THEN** the system returns a successful idempotent logout response and clears any stale `refresh_token` cookie

### Requirement: Account lockout
The system SHALL track login failures per normalized email in memory and SHALL lock an account key for 15 minutes after 5 consecutive failed login attempts.

#### Scenario: Account becomes locked
- **WHEN** the same normalized email accumulates 5 consecutive failed login attempts
- **THEN** the system locks that account key for 15 minutes and rejects further login attempts with `ErrAccountLocked`

#### Scenario: Successful login clears failures
- **WHEN** a user successfully logs in before reaching the lockout threshold
- **THEN** the system clears the failure count for that normalized email

### Requirement: Global IP rate limiting
The system SHALL apply a global in-memory IP-based rate limiter to API requests and SHALL return `ErrTooManyRequests` for requests over the configured threshold.

#### Scenario: IP limit exceeded
- **WHEN** a client IP exceeds the configured in-memory request threshold
- **THEN** the system rejects further requests from that IP with HTTP 429 and `ErrTooManyRequests`

#### Scenario: In-memory limiter boundary
- **WHEN** the server process restarts
- **THEN** in-memory IP counters and account lockout counters are cleared
