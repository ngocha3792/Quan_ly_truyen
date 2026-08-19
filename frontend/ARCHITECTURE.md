# Frontend architecture guardrails

## Component files

Application components use co-located TypeScript, HTML, and SCSS files. Inline templates and styles are legacy debt and must not increase. A styleless component may omit its SCSS file.

`shared`, `layout`, and `features/public` have completed this migration: inline templates and styles are forbidden there. The architecture check keeps both scoped counters at zero.

Page components coordinate routes and stores. Reusable UI components receive inputs and emit outputs; they do not call HTTP APIs directly.

## Feature layout

Features converge on these boundaries:

- `domain`: models, repository contracts, and pure policies.
- `data-access`: HTTP adapters, providers, and stores.
- `pages`: route-level containers.
- `ui`: presentation components.

Dependencies flow inward:

- `pages` may compose `ui`, coordinate `data-access`, and consume `domain` types.
- `ui` may depend on `domain` and shared presentation code, but not on `pages` or `data-access`.
- `data-access` may implement and consume `domain`, but not depend on `pages` or `ui`.
- `domain` must not depend on `pages`, `ui`, `data-access`, or Angular.

## Shared ownership

Use the narrowest owner that matches the capability:

- `features/<scope>/shared`: reusable **only inside the same scope** (`account`, `public`, `admin`, or `author-portal`). Cross-scope imports into another scope's `shared` internals are forbidden.
- `core`: application-wide state/infrastructure or cross-scope product capabilities with a stable public contract. Example: `core/author-follow` is consumed by both public author views and account following pages.
- `shared`: presentation-only primitives reused across the application.

Feature-to-feature imports may use another feature's root public API, but must not import its internals.

`npm run architecture:check` enforces these rules for both relative and configured alias imports.

## Runtime FE-BE contracts

Frontend policy/config values that belong to backend product rules must come from a backend contract, not duplicated literals. Authentication runtime config is loaded from `GET /api/v1/auth/client-config` and contains CSRF settings, password policy, and password-reset TTL for both browser and SSR runtimes.

Production V1 screen/API wiring is documented in `../backend/ops/production/API_CONTRACT_MATRIX.md` and enforced by `node ../scripts/verify-api-contracts.mjs`.

## Debt ratchet

`npm run architecture:check` records the current upper bound for inline templates, inline styles, and total lines exceeding the target budget for each file type. A change may reduce these values but must not increase them. Hard line limits prevent a single file from growing beyond the current worst cases.

Update a debt baseline only after debt has actually been removed. Never increase a baseline only to make CI pass.

Component classes have a 500-line hard cap and a 250-line target. Stores have a 600-line hard cap and a 300-line target. New code should meet the target; legacy files above it may only shrink.

## Strict compilation

Application and test TypeScript compile with `strict`. Angular templates compile with `strictTemplates`, strict injection parameters, and strict input access modifiers.

Do not suppress strict errors with broad casts or `any`. Narrow values at their boundary and keep template guards aligned with the types rendered inside each control-flow block.

## Change discipline

Keep mechanical refactors separate from behavior changes where practical. Preserve selectors, route URLs, and API contracts during extraction. Every refactoring wave must pass formatting, architecture, lint, type checking, tests, and the production build.
