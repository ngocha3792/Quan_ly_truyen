# Phase 5 — Author profile, following, follower notifications

## Canonical data

- Public author name is `AuthorProfile.penName`; `User.displayName` remains account identity.
- Author slug is immutable during normal profile edits.
- Avatar association is `User.avatarMediaId` with `MediaPurpose.AVATAR`.
- Banner association is `AuthorProfile.bannerMediaId` with `MediaPurpose.AUTHOR_BANNER`.
- `UserFollowAuthor` rows are the source of truth for follow relationships.
- `AuthorProfile.followerCount` is a denormalized read counter and can be repaired with the reconciliation command below.

## Migration / follower-count decision

There was no historical user-to-author follow relation before Phase 5. The migration therefore does **not** invent follower identities from existing numeric counters. On migration, `AuthorProfile.followerCount` is reconciled to the real `UserFollowAuthor` relation count. For an installation with no other historical follow source, that means existing synthetic counters become `0` deterministically.

If a deployment has an external authoritative follow source, migrate those identities into `user_follow_authors` before changing this policy.

## Reconciliation

Dry-run is the default:

```bash
npm run maintenance:author-followers
```

Apply repairs explicitly:

```bash
npm run maintenance:author-followers -- --apply
```

A single author can be checked with `--author-id=<uuid>`.

## Notification delivery

A successful chapter `DRAFT -> PUBLISHED` transaction writes exactly one outbox event with idempotency key `author-chapter-published:<chapterId>`. The existing outbox dispatcher routes `aggregateType=notifications` to `QUEUE_NAMES.NOTIFICATIONS`.

The notification worker:

- reads followers in cursor batches of 500;
- requires the follow to still exist;
- requires `follow.createdAt <= publishedAt`;
- respects `newChapterEnabled` and `inAppEnabled`;
- skips inactive/deleted recipients and non-active authors;
- inserts notifications with the unique dedupe key `new-chapter:<chapterId>:<userId>`.

Retries can therefore restart from the beginning without duplicating user notifications.

## Rollout

1. Run the database migration.
2. Deploy worker code that understands `notification.author-chapter-published.v1` and the notifications outbox route.
3. Deploy API code that emits the new event (or deploy API + worker from the exact same SHA so the consumer exists before traffic switches).
4. Deploy frontend profile/follow UI.
5. Run integration and Playwright journeys.

Phase 5 intentionally delivers in-app new-chapter notifications only; email fan-out is not enabled here.
