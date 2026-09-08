# Sprint 3 comic delivery

Comic delivery is gated by `READER_COMIC_DELIVERY_ENABLED`. Production also enables the stable document, portable cursor, realtime progress and inline-comment prerequisites.

Chapter images are uploaded as Cloudinary `authenticated` assets with asynchronous AVIF, WebP and JPEG eager transformations. Confirmation persists authoritative dimensions and creates idempotent slice metadata for tall images. The public reader returns media only after chapter access is resolved; paid media without authenticated delivery metadata is omitted fail-closed.

Slice URLs use normalized crop transformations over the original asset. Angular reserves each slice's aspect ratio, observes a one-viewport margin, and removes off-screen image elements so decoded bitmaps can be reclaimed. Comic comment regions are stored as normalized coordinates constrained to `[0,1]` by application validation and a database check.

Production variables:

```env
READER_COMIC_DELIVERY_ENABLED=true
CLOUDINARY_EAGER_NOTIFICATION_URL=https://your-domain/api/v1/webhooks/cloudinary
```

Before rollout, provision the Cloudinary upload preset to accept authenticated uploads and eager transformations, apply both Sprint 3 migrations, and validate a paid and free comic chapter on staging.
