# Cloudinary production setup

The application uses signed direct uploads. The API creates a short-lived signed upload intent, the browser uploads directly to Cloudinary, and Cloudinary notifies the API at:

```text
https://<public-app-origin>/api/v1/webhooks/cloudinary
```

Do not commit the Cloudinary API secret. Both `.env` and `.env.production` are ignored by Git.

## Required configuration

Copy these values from the Cloudinary product environment into `.env.production`:

```dotenv
CLOUDINARY_ENABLED=false
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
CLOUDINARY_ROOT_FOLDER=quan-ly-truyen
CLOUDINARY_SIGNATURE_ALGORITHM=sha256
```

Preset names, upload limits and formats come from the backend constants and media policy registry. Environment variables named `CLOUDINARY_*_UPLOAD_PRESET` are optional, explicit overrides only.

`APP_PUBLIC_URL` must be the public HTTPS origin that routes `/api/v1` to the API. Set `CLOUDINARY_WEBHOOK_URL` only when the webhook uses a different public origin.

## Provision the presets

Preview the five presets without changing Cloudinary:

```powershell
npm run cloudinary:provision -- --env-file=.env.production
```

Apply the configuration:

```powershell
npm run cloudinary:provision -- --env-file=.env.production --apply
```

The command is idempotent. It creates missing presets and updates existing presets with these controls:

- signed uploads only;
- unique public IDs and no overwrite;
- per-purpose allowed formats and maximum file sizes matching the backend media policy;
- an HTTPS upload notification URL for the Cloudinary webhook inbox.

## Verify and enable

Keep `CLOUDINARY_ENABLED=false` until provisioning succeeds. Then change it to `true` and run:

```powershell
npm run ci:verify-cloudinary -- --env-file=.env.production
$env:NODE_ENV='production'
npm run production:gate:predeploy
```

The verification command authenticates with Cloudinary and confirms that all five presets exist and are signed. It never prints the API secret.

After deployment, perform one upload for each enabled flow and confirm:

1. the upload intent returns a signed Cloudinary payload;
2. the asset is stored below `CLOUDINARY_ROOT_FOLDER`;
3. `POST /api/v1/webhooks/cloudinary` returns HTTP 200;
4. the webhook inbox is drained by the worker;
5. the media record reaches `READY` and can be attached to its owner.

If webhook processing is not running continuously, execute:

```powershell
npm run maintenance:cloudinary-webhooks
```

Cloudinary signs notifications with `X-Cld-Timestamp` and `X-Cld-Signature`; the API rejects missing, expired, or invalid signatures.
