## ADDED Requirements

### Requirement: Home page for unauthenticated users
The system SHALL render the LittleAgResume Home Page at `/` for unauthenticated users.

#### Scenario: Unauthenticated home visit
- **WHEN** an unauthenticated user visits `/`
- **THEN** the system displays the Home Page with AppHeader, Hero, placeholder resume preview, feature cards, example preview, and Footer

#### Scenario: Mobile home layout
- **WHEN** the Home Page is viewed at 375px width
- **THEN** the layout has no horizontal overflow and the authentication dialog remains usable

### Requirement: Authenticated home redirect
The system SHALL redirect authenticated users from `/` to `/console`.

#### Scenario: Authenticated visit to home
- **WHEN** a user with a valid restored session visits `/`
- **THEN** the system redirects the user to `/console`

#### Scenario: Failed session restoration on home
- **WHEN** session restoration fails while visiting `/`
- **THEN** the system treats the user as unauthenticated and renders the Home Page

### Requirement: Auth modal entry points
The Home Page SHALL provide login and registration entry points through a Dialog-based AuthModal on desktop and mobile.

#### Scenario: Start button opens registration
- **WHEN** the user clicks the Hero primary action
- **THEN** the AuthModal opens with the registration tab selected

#### Scenario: Login button opens login
- **WHEN** the user clicks the Header login action
- **THEN** the AuthModal opens with the login tab selected

#### Scenario: Dialog consistency
- **WHEN** the AuthModal opens on desktop or mobile
- **THEN** it uses Dialog behavior rather than a mobile-only Sheet

### Requirement: Registration and login forms
The AuthModal SHALL include validated registration and login forms and SHALL map backend numeric error codes to user-visible field or form errors.

#### Scenario: Registration form fields
- **WHEN** the registration tab is shown
- **THEN** the form includes username, email, password, and confirmPassword fields with validation

#### Scenario: Login form fields
- **WHEN** the login tab is shown
- **THEN** the form includes email and password fields with validation

#### Scenario: Backend error display
- **WHEN** the backend returns a non-zero authentication error code
- **THEN** the frontend displays an appropriate field-level or form-level error without crashing

### Requirement: Console landing page
The system SHALL provide a minimal authenticated `/console` landing page for successful registration and login.

#### Scenario: Successful registration lands on console
- **WHEN** registration succeeds from the Home Page
- **THEN** the frontend stores the Access Token in memory, closes the AuthModal, and navigates to `/console`

#### Scenario: Successful login lands on console
- **WHEN** login succeeds from the Home Page
- **THEN** the frontend stores the Access Token in memory, closes the AuthModal, and navigates to `/console`

#### Scenario: Console session restoration
- **WHEN** a user visits `/console` without an in-memory Access Token but with a valid Refresh Token cookie
- **THEN** the frontend refreshes the session, loads the current user, and displays the Console page

### Requirement: In-page example preview
The Home Page SHALL keep the "view example" action inside the Home Page rather than navigating to a separate template page.

#### Scenario: View example action
- **WHEN** the user clicks the "查看示例" action
- **THEN** the Home Page scrolls or focuses to the in-page placeholder example preview
