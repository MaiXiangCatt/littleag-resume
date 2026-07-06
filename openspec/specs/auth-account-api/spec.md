# auth-account-api Specification

## Purpose
TBD - created by archiving change home-page-auth. Update Purpose after archive.
## Requirements
### Requirement: Unified auth API responses
All authentication API endpoints SHALL return a `BaseResponse` JSON body with `code`, `message`, and `data` fields. A successful response SHALL use `code: 0` and `message: ""`. An error response SHALL use a non-zero numeric code from the documented error code table and SHALL set `data` to null.

#### Scenario: Successful response envelope
- **WHEN** a user registers, logs in, refreshes a session, requests the current user, or logs out successfully
- **THEN** the API response body contains `code: 0`, `message: ""`, and the endpoint-specific `data` value

#### Scenario: Error response envelope
- **WHEN** an authentication endpoint rejects a request due to validation, credentials, token, lockout, rate limit, or server error
- **THEN** the API response body contains a non-zero numeric `code`, a human-readable `message`, and `data: null`

### Requirement: User registration
The system SHALL expose `POST /api/auth/register` to create an active user with `username`, `email`, and `password`. The request SHALL require `confirmPassword` and SHALL reject mismatched passwords.

#### Scenario: Successful registration
- **WHEN** an unauthenticated client submits a valid unique `username`, a valid unique `email`, a strong `password`, and a matching `confirmPassword`
- **THEN** the system creates a user, stores only a bcrypt password hash, returns an Access Token and `AuthUser`, and sets a Refresh Token cookie

#### Scenario: Duplicate email registration
- **WHEN** a registration request uses an email that belongs to a non-deleted user after case-insensitive normalization
- **THEN** the system rejects the request with `ErrEmailExists`

#### Scenario: Duplicate username registration
- **WHEN** a registration request uses a username that belongs to a non-deleted user with the same exact case-sensitive value
- **THEN** the system rejects the request with `ErrUsernameExists`

#### Scenario: Invalid registration input
- **WHEN** a registration request has an invalid email, invalid username, weak password, or mismatched confirmation password
- **THEN** the system rejects the request with the corresponding validation error code

### Requirement: User login
The system SHALL expose `POST /api/auth/login` to authenticate an existing active user by email and password without revealing whether the email exists.

#### Scenario: Successful login
- **WHEN** a client submits an email and password that match an active user
- **THEN** the system returns an Access Token and `AuthUser`, sets a Refresh Token cookie, and clears the account-level failure counter

#### Scenario: Invalid credentials
- **WHEN** a client submits an unknown email or an incorrect password
- **THEN** the system rejects the request with `ErrInvalidCredential`

#### Scenario: Soft-deleted user cannot log in
- **WHEN** a login request targets a soft-deleted user record
- **THEN** the system treats the user as inactive and rejects the request with `ErrInvalidCredential`

### Requirement: Current user lookup
The system SHALL expose `GET /api/auth/me` and SHALL require a valid Access Token in the `Authorization: Bearer <token>` header.

#### Scenario: Current user success
- **WHEN** a client calls `/api/auth/me` with a valid non-expired Access Token
- **THEN** the system returns the authenticated user's `id`, `username`, and `email`

#### Scenario: Missing or invalid Access Token
- **WHEN** a client calls `/api/auth/me` without a valid Access Token
- **THEN** the system rejects the request with the appropriate unauthorized, expired token, or invalid token error code

### Requirement: Auth user shape
The system SHALL expose authenticated user data as an `AuthUser` object containing `id`, `username`, and `email`.

#### Scenario: Auth user returned by auth endpoints
- **WHEN** registration, login, refresh, or current-user lookup succeeds
- **THEN** the response includes an `AuthUser` with `id`, `username`, and `email`, and excludes password hash and refresh token data

