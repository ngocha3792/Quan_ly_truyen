# Backend endpoints currently available

Base path: `/api/v1`

## Authentication

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `POST /auth/revoke-access-token`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password`
- `POST /auth/change-email`
- `POST /auth/change-email/confirm`
- `GET /auth/me`
- `GET /auth/sessions`
- `DELETE /auth/sessions/:sessionId`
- `GET /auth/security-events?limit=20`

## Media

- `POST /media/upload-intents`
- `POST /media/upload-intents/:mediaAssetId/confirm`
- `GET /media/:mediaAssetId`
- `DELETE /media/:mediaAssetId`

## Health

- `GET /health/live`
- `GET /health/ready`
- `GET /health/diagnostics`

The remaining domain folders are based on the Prisma schema and are ready for future controllers.
