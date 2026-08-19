# Production V1 API Contract Matrix

> Generated from `api-contracts.production-v1.json`. Do not edit by hand.
>
> Scope: important Production V1 user-facing screens and their HTTP dependencies. Every declared contract is required to have both a backend controller binding and at least one frontend consumer binding. Operational, webhook, maintenance and intentionally backend-only integration endpoints are outside this screen matrix.

| Screen | Frontend route/surface | FE ↔ BE contracts | Frontend consumer files |
| --- | --- | --- | --- |
| Auth bootstrap / login / register | global bootstrap + auth dialog | `GET /auth/client-config`<br>`POST /auth/login`<br>`POST /auth/register`<br>`GET /auth/me` | `frontend/src/app/core/config/app-runtime-config.loader.ts`<br>`frontend/src/app/core/config/app-runtime-config.server.ts`<br>`frontend/src/app/core/auth/auth-api.service.ts` |
| Forgot / reset password | /quen-mat-khau + /dat-lai-mat-khau | `POST /auth/forgot-password`<br>`POST /auth/reset-password/validate`<br>`POST /auth/reset-password` | `frontend/src/app/core/auth/auth-api.service.ts` |
| Account profile / preferences / security | /tai-khoan/* | `GET /users/me`<br>`PATCH /users/me`<br>`POST /auth/change-password` | `frontend/src/app/features/account/profile/profile/data-access/account-profile-api.service.ts`<br>`frontend/src/app/features/account/profile/security/data/account-security-api.service.ts` |
| Public catalog / story detail | /truyen + /truyen/:slug | `GET /stories`<br>`GET /stories/:slug` | `frontend/src/app/core/http/public-stories-api.client.ts` |
| Chapter reader / progress / bookmark | /truyen/:slug/chuong-:chapter | `GET /stories/:storySlug/chapters/:chapterNumber`<br>`PUT /reading-progress/:storyId`<br>`GET /reading-bookmarks/:chapterId`<br>`PUT /reading-bookmarks/:chapterId`<br>`DELETE /reading-bookmarks/:chapterId` | `frontend/src/app/features/public/chapter-reader/data-access/chapter-reader-http.repository.ts`<br>`frontend/src/app/core/http/reader-engagement-api.client.ts` |
| My Library | /thu-vien | `GET /library`<br>`PUT /library/:storyId` | `frontend/src/app/features/account/my-library/data-access/my-library-http.repository.ts` |
| Reading history | /lich-su-doc | `GET /reading-history`<br>`GET /reading-bookmarks` | `frontend/src/app/features/account/reading-history/data-access/reading-history-http.repository.ts` |
| Follow authors / following list | /dang-theo-doi + public author surfaces | `POST /authors/:authorId/follow`<br>`DELETE /authors/:authorId/follow`<br>`GET /me/following` | `frontend/src/app/core/author-follow/data-access/author-follow-api.service.ts` |
| Notifications | /thong-bao | `GET /notifications`<br>`PATCH /notifications/:notificationId/read`<br>`PATCH /notifications/settings` | `frontend/src/app/features/account/notifications/data-access/notifications-http.repository.ts` |
| Author application | /dang-ky-tac-gia | `GET /author-applications/config`<br>`PUT /author-applications/me/draft`<br>`POST /author-applications/me/submit` | `frontend/src/app/features/account/author-application/data-access/author-application-api.repository.ts` |
| Author dashboard / profile | /author-studio + /author-studio/profile | `GET /author/dashboard`<br>`GET /author/profile`<br>`PATCH /author/profile` | `frontend/src/app/features/author-portal/author-studio/data-access/author-studio-http.repository.ts`<br>`frontend/src/app/features/author-portal/author-profile/data-access/author-profile-http.repository.ts` |
| Author story / chapter studio | /author-studio/truyen/* | `GET /author/stories`<br>`POST /author/stories`<br>`POST /author/stories/:storyId/chapters`<br>`POST /author/stories/:storyId/chapters/:chapterId/publish` | `frontend/src/app/features/author-portal/author-studio/data-access/author-story-management-http.repository.ts` |
| Author analytics | /author-studio/analytics/* | `GET /author/analytics/overview`<br>`GET /author/analytics/stories` | `frontend/src/app/features/author-portal/analytics/data-access/author-analytics-http.service.ts` |
| Admin users | /admin/users/* | `GET /admin/users`<br>`PATCH /admin/users/:userId/status` | `frontend/src/app/features/admin/users/data-access/admin-users-api.service.ts` |
| Admin authors | /admin/authors/* | `GET /admin/authors`<br>`PATCH /admin/authors/:authorId/status` | `frontend/src/app/features/admin/authors/data-access/admin-authors-api.service.ts` |
| Admin story review | /admin/stories/* | `GET /admin/story-submissions`<br>`POST /admin/story-submissions/:submissionId/approve`<br>`POST /admin/story-submissions/:submissionId/reject` | `frontend/src/app/features/admin/stories/data-access/admin-stories-api.service.ts` |
| Admin reports / moderation | /admin/reports/* | `GET /admin/reports`<br>`POST /admin/reports/:reportId/resolve`<br>`POST /admin/reports/:reportId/reject` | `frontend/src/app/features/admin/reports/data-access/admin-reports-api.service.ts` |
| Admin categories / tags | /admin/categories + /admin/tags | `GET /admin/categories`<br>`POST /admin/categories`<br>`GET /admin/tags` | `frontend/src/app/features/admin/categories/data-access/admin-categories-api.service.ts`<br>`frontend/src/app/features/admin/tags/data-access/admin-tags-api.service.ts` |
| Admin author applications | /admin/author-applications/* | `GET /author-applications/admin`<br>`POST /author-applications/admin/:applicationId/approve`<br>`POST /author-applications/admin/:applicationId/reject` | `frontend/src/app/features/admin/author-applications/data-access/admin-author-applications-api.service.ts` |
| Admin audit logs | /admin/audit-logs/* | `GET /admin/audit-logs`<br>`GET /admin/audit-logs/:auditLogId` | `frontend/src/app/features/admin/audit-logs/data-access/admin-audit-logs-api.service.ts` |

## Enforcement

- `node scripts/verify-api-contracts.mjs` verifies every declared backend/frontend binding and fails on matrix drift.
- `node scripts/verify-api-contracts.mjs --write` regenerates this table after an intentional contract change.
- A new Production V1 screen that performs HTTP I/O must add its important contracts to the manifest in the same change.
- Backend-only operational/webhook/maintenance endpoints are not evidence of a missing UI; they are deliberately outside this screen-oriented contract.
