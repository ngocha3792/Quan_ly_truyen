# Admin MFA and OAuth backend

## Database and startup

After pulling this change, regenerate Prisma Client and apply the migration:

```bash
npm ci
npm run db:migrate
```

For production, deploy the migration before starting the new API/worker image.
The migration creates `admin_mfa_credentials`, adds `sessions.mfa_verified_at`,
and enforces one OAuth identity per provider for each user.

## Admin MFA flow

1. `POST /api/v1/auth/login` validates the password.
2. An Admin account does not receive a session immediately. The API returns
   `412 AUTH_ADMIN_MFA_REQUIRED` or `AUTH_ADMIN_MFA_ENROLLMENT_REQUIRED` with
   `details.mfaTicket`.
3. First-time enrollment:
   - `POST /api/v1/auth/mfa/admin/enrollment` with `{ "mfaTicket": "..." }`;
   - add the returned `otpAuthUri` to an authenticator application;
   - `POST /api/v1/auth/mfa/admin/enrollment/confirm` with the ticket and
     six-digit `totpCode`.
4. Later logins call `POST /api/v1/auth/mfa/admin/verify` with the ticket and
   exactly one of `totpCode` or `recoveryCode`.
5. Recovery codes are returned only once after enrollment and are stored only
   as SHA-256 hashes. The TOTP secret is encrypted with AES-256-GCM.
6. When MFA is enabled, Admin access tokens are rejected unless their database
   session has `mfa_verified_at` set. Assigning the Admin role to a user does
   not turn an older non-MFA session into a valid Admin session.

Example verification request:

```json
{
  "mfaTicket": "pre-auth-ticket",
  "totpCode": "123456",
  "deviceName": "Chrome on Windows"
}
```

## OAuth flow

Supported providers: Google and GitHub.

- `GET /api/v1/auth/oauth/google`
- `GET /api/v1/auth/oauth/google/callback`
- `GET /api/v1/auth/oauth/github`
- `GET /api/v1/auth/oauth/github/callback`

Open the provider start endpoint as a top-level browser navigation. It stores a
short-lived state cookie and redirects to the provider. The backend uses
Authorization Code flow, one-time Redis state bound to a host-only HttpOnly
SameSite=Lax browser cookie, Google nonce, and PKCE S256.

Provider access tokens are used only to fetch the verified identity and are not
persisted. An existing account is linked automatically only when its local email
is already verified. A newly created OAuth account receives the USER role.
Admin users coming from OAuth still complete the same MFA flow before a session
is created.

The current callback returns the normal backend login JSON response. A future
frontend may replace that with a one-time frontend handoff code without changing
provider verification or account-linking logic.

## Provider configuration

Register these exact callback URLs in the provider console:

```text
https://api.example.com/api/v1/auth/oauth/google/callback
https://api.example.com/api/v1/auth/oauth/github/callback
```

Enable only providers whose complete credentials are present:

```dotenv
AUTH_OAUTH_ENABLED=true
AUTH_OAUTH_GOOGLE_ENABLED=true
AUTH_OAUTH_GOOGLE_CLIENT_ID=...
AUTH_OAUTH_GOOGLE_CLIENT_SECRET=...
AUTH_OAUTH_GOOGLE_CALLBACK_URL=https://api.example.com/api/v1/auth/oauth/google/callback

AUTH_OAUTH_GITHUB_ENABLED=true
AUTH_OAUTH_GITHUB_CLIENT_ID=...
AUTH_OAUTH_GITHUB_CLIENT_SECRET=...
AUTH_OAUTH_GITHUB_CALLBACK_URL=https://api.example.com/api/v1/auth/oauth/github/callback
```

## Required production variables

- `AUTH_ADMIN_MFA_ENABLED=true`
- `AUTH_MFA_ENCRYPTION_KEY`: base64 of exactly 32 random bytes
- `AUTH_OAUTH_ENABLED=true` when OAuth is enabled
- `AUTH_OAUTH_STATE_COOKIE_NAME=oauth_state`; it must differ from refresh and
  CSRF cookie names
- provider client ID, client secret and exact HTTPS callback URL
- Redis enabled, because MFA tickets and OAuth state are one-time records

Facebook remains intentionally unsupported at runtime. Add it only after a
provider-specific verified-email policy and integration tests are in place.
