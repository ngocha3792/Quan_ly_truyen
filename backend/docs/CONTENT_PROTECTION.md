# Practical content protection

Paid chapter bodies remain server-side entitlement decisions with
`private, no-store` response semantics. Paid Cloudinary media uses the existing
authenticated/signed delivery path; free media stays public. `LeakTokenService`
creates a short-lived HMAC token containing a pseudonymous user hash, asset,
chapter and expiry. It never embeds a raw user ID. The token can be decoded by
an internal investigation tool without brute-forcing the user identity.

Visible watermarking should be subtle and used only for paid media. The token
prefix is suitable for a forensic overlay; full token data must never be sent
to Angular as a hidden tracking field.

The product deliberately does not block selection, copy, right-click,
DevTools, TTS, screen readers or dynamic fonts. Those controls are bypassable
and would break inline comments, accessibility, search and offline reading.

`LEAK_TOKEN_SECRET` should be a dedicated production secret. Rotate it through
an explicit incident procedure because rotation invalidates forensic decoding
for older tokens. A real deployment must verify Cloudinary delivery type,
short-lived URLs and entitlement revocation in staging before enabling paid
media rollout.
