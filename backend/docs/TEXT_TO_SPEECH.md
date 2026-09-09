# Text to speech

Sprint 5 adds two explicit reader modes behind `READER_TEXT_TO_SPEECH_ENABLED`:

- Browser speech uses the Web Speech API and remains available for offline chapter snapshots.
- Provider audio uses a dedicated ElevenLabs adapter, BullMQ worker, Cloudinary storage, per-user cache and monthly character quota.

Provider generation requires `READER_CONTENT_DOCUMENT_ENABLED=true`, Redis/queue, Cloudinary, and a valid 32-byte `AI_API_KEY_ENCRYPTION_KEY_BASE64`. The key material is reused only as the encryption root; TTS has its own vault envelope and AAD and never calls the AI chat gateway.

## HTTP contract

| Method | Path | Purpose |
| --- | --- | --- |
| `GET/POST` | `/api/v1/tts/connections` | List or create the user's provider connections. |
| `DELETE` | `/api/v1/tts/connections/:connectionId` | Disable an owned connection. |
| `POST` | `/api/v1/tts/manifests` | Reserve quota and enqueue one chapter-version manifest. Requires an idempotency key. |
| `GET` | `/api/v1/tts/manifests/:manifestId` | Poll status and receive fresh audio URLs. |
| `GET` | `/api/v1/tts/quota` | Read monthly usage and reservation totals. |
| `POST/DELETE` | `/api/v1/admin/tts/connections` | Manage explicit system connections. |

`fallbackPolicy` defaults to `NONE`. A system credential is used only when the request explicitly stores `SYSTEM`; the worker records a structured fallback event without logging credentials.

## Rollout

Keep the flag false until the migration is applied and API, worker, Redis and Cloudinary are deployed together. Verify a free chapter, a paid entitled chapter, revoked entitlement, quota exhaustion, worker retry, browser speech, playback speed, offline browser speech, and cleanup of failed reservations in staging.
