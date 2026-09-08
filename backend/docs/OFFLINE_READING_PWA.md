# Offline reading and PWA

## Scope and invariants

Offline reading is an opt-in reader feature controlled by
`READER_OFFLINE_READING_ENABLED`. The implementation uses a dedicated
`/api/v1/offline-packages` contract. The normal chapter reader endpoint is
never cached as an offline response.

An offline package is an immutable server-side snapshot. Creating a package
copies the selected published chapter content document, chapter metadata,
access decision, and media delivery metadata in one serializable transaction.
Later chapter edits or deletion do not silently replace the downloaded
snapshot with newer content.

The server accepts only:

- public, published free chapters; or
- public, published paid chapters with an active entitlement backed by a
  completed purchase for the requesting user.

Quota and access are checked while the relevant session, chapters,
monetization rows, entitlements, packages, and user quota are locked. The
default limits are five packages, 50 chapters per package, and 500 MiB per
user. A package license lasts 30 days and inactive packages are eligible for
deletion after 90 days.

## HTTP contract

All endpoints require an authenticated session, the
`LIBRARY_MANAGE_OWN` permission, and the feature flag to be enabled. Responses
are private and use `Cache-Control: private, no-store`.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/offline-packages` | Create an immutable package snapshot. Requires `x-idempotency-key`. |
| `GET` | `/api/v1/offline-packages` | List the current user's server packages and status. |
| `GET` | `/api/v1/offline-packages/quota` | Return package, chapter, and byte limits and remaining capacity. |
| `GET` | `/api/v1/offline-packages/:packageId/manifest` | Return the session-bound snapshot and fresh media delivery URLs. |
| `PATCH` | `/api/v1/offline-packages/:packageId/touch` | Refresh the last-accessed timestamp and inactivity deadline. |
| `DELETE` | `/api/v1/offline-packages/:packageId` | Delete the owned server package and reconcile quota. |

Create body:

```json
{
  "name": "Doc tren duong di",
  "description": "Cac chuong da chon",
  "chapterIds": ["00000000-0000-4000-8000-000000000000"]
}
```

Byte counts are decimal strings in JSON so values do not lose precision in a
browser. Package creation is replay-safe for 24 hours through the application's
shared idempotency interceptor.

## Browser storage

The Angular client stores package metadata, chapter snapshots, media blobs,
and unsynchronized reading progress in native IndexedDB. Every key is scoped by
`userId + sessionId`. Activating a different account or session clears the old
scope before any new data is written.

Before downloading, the client checks both the server quota and browser
storage estimate. Its local budget is the lower of 500 MiB and 70 percent of
the browser-reported origin quota. Expired packages are removed first, then
least-recently-used packages. An interrupted download remains unreadable and
is removed transactionally on failure.

The service worker caches only static application-shell assets and media URLs
explicitly supplied by a validated package manifest. It must not cache generic
`/api` traffic, cookies, authorization responses, or the normal chapter reader
response. Private asset cache names contain a one-way hash of the active
`userId + sessionId` scope.

## Session, revocation, and progress lifecycle

- Logout, invalid session, or an account/session switch clears IndexedDB,
  private Cache Storage entries, and in-memory package state immediately.
- A temporary network or refresh failure (`access-lost`) does not erase a
  valid offline package.
- Revoking or deleting a server session revokes its packages in the same
  database transaction through a trigger before the session reference is set
  to null.
- Revoking or deleting a paid chapter entitlement revokes every package that
  contains that entitlement snapshot.
- On a successful online refresh, the client reconciles server state and
  deletes local packages that are missing, expired, or revoked.
- Offline progress retains the existing portable cursor, revision,
  `deviceId`, and `clientEventId` contract. Reconnect replays the same event ID
  so the server can deduplicate it and apply the existing revision policy.

An offline reader fallback is allowed only for a connection failure or when
the browser is offline. An online `LOCKED` response is authoritative and must
never be replaced with locally stored content.

## Installation and deployment

The service worker is registered only by a production browser build. Deploy
the application on HTTPS (localhost is the development exception), enable the
feature on the API, and keep the worker script revalidation-safe:

```env
READER_CONTENT_DOCUMENT_ENABLED=true
READER_PORTABLE_CURSOR_ENABLED=true
READER_REALTIME_PROGRESS_SYNC_ENABLED=true
READER_OFFLINE_READING_ENABLED=true
```

Startup validation rejects offline reading when any of the three prerequisite
flags is disabled. Without them, immutable blocks or reconnect-safe progress
metadata would not have a compatible server contract.

Required response headers:

```text
/sw.js
Cache-Control: no-cache
Service-Worker-Allowed: /
```

The production artifact must contain `manifest.webmanifest`, `sw.js`, and valid
192x192 and 512x512 maskable icons. Validate those files after `npm run
build:ci`; do not infer PWA installability from a TypeScript build alone.

## User flow

1. Open `Tai khoan > Doc offline` while online.
2. Create a package by choosing a story and up to the displayed chapter limit.
3. Download the ready package and wait for the local progress indicator to
   finish.
4. Open the package or its chapter from the same browser session while the
   network is unavailable.
5. Reconnect to synchronize pending progress and refresh revocation state.
6. Remove the local copy separately, or delete the server package and its local
   copy together.

## Security limitation

Offline content cannot be made secret from the owner of the device that stores
it. A user with local browser or filesystem access can inspect IndexedDB,
Cache Storage, memory, or rendered output. Encryption with a key delivered to
the same client does not remove that limitation.

The controls here reduce accidental and cross-account disclosure: server-side
entitlement checks, immutable access snapshots, session-bound manifests,
short package licenses, revocation, account-scoped stores, explicit cache
allowlists, and cleanup. They are not DRM and must not be described as perfect
copy protection in product or legal text.

## Verification

Implementation validation (2026-09-09): backend 205 suites / 864 unit tests
and frontend 57 files / 267 tests passed. Both production builds, architecture,
type and lint checks passed. PWA artifacts contain 122 explicit shell assets
and correctly sized 192/512 icons; the worker response headers were checked.
Live PostgreSQL integration remains unverified because the configured test
database at 127.0.0.1:5433 is unavailable. Real-browser installation, cold-start
and performance acceptance remain pending. Keep the offline feature disabled
in production until those checks pass.

Media snapshots are protected by normalized package media pins, released when
the package leaves READY or is deleted. Private service-worker media caches
are transient download staging; licensed offline reads use IndexedDB blobs.
The standalone launcher is `/doc-offline`. Revocation reconciliation runs every
four minutes while the authenticated tab is visible and connected; a fully
disconnected device cannot receive remote revocation until it reconnects.

At minimum, a release should verify:

- policy and handler unit tests;
- migration constraints and session/entitlement trigger regression tests;
- unauthorized ownership and entitlement cases;
- IndexedDB scope isolation, rollback, expiry, and LRU behavior;
- service-worker URL allowlisting and private-cache cleanup;
- logout/account-switch cleanup while `access-lost` preserves data;
- online `LOCKED` behavior and connection-failure-only reader fallback;
- production build artifact presence and worker response headers; and
- a real-browser install/download/offline/read/reconnect scenario on staging.

The target download time, IndexedDB latency, and cache-hit metrics in the sprint
plan require representative media and real-browser instrumentation. Unit tests
or a local static build are not evidence that those production performance
targets have been met.
