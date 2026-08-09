# Frontend architecture guardrails

## Component files

Application components use co-located TypeScript, HTML, and SCSS files. Inline templates and styles are legacy debt and must not increase. A styleless component may omit its SCSS file.

Page components coordinate routes and stores. Reusable UI components receive inputs and emit outputs; they do not call HTTP APIs directly.

## Feature layout

Features converge on these boundaries:

- `domain`: models, repository contracts, and pure policies.
- `data-access`: HTTP adapters, providers, and stores.
- `pages`: route-level containers.
- `ui`: presentation components.

Cross-feature code belongs in `core` only when it is application-wide infrastructure, or in `shared` when it is presentation-only and reusable.

Dependencies flow inward:

- `pages` may compose `ui`, coordinate `data-access`, and consume `domain` types.
- `ui` may depend on `domain` and shared presentation code, but not on `pages` or `data-access`.
- `data-access` may implement and consume `domain`, but not depend on `pages` or `ui`.
- `domain` must not depend on `pages`, `ui`, `data-access`, or Angular.

`npm run architecture:check` enforces these directions for relative imports inside `src/app/features`.

## Debt ratchet

`npm run architecture:check` records the current upper bound for inline templates, inline styles, and total lines exceeding the target budget for each file type. A change may reduce these values but must not increase them. The excess-line metric allows one large component to be split into several focused files without penalizing the extraction merely because the file count grows. Hard line limits prevent a single file from growing beyond the current worst cases.

Update the baseline only after debt has been removed. Do not increase a baseline to make CI pass.

## Mechanical asset extraction

Use `node scripts/extract-inline-component-assets.mjs <feature-path>` for a dry run, then add
`--write` to extract static inline templates and styles into co-located `.html` and `.scss` files.
The script refuses to overwrite existing assets and rejects interpolated TypeScript template
literals, so those cases must be reviewed manually.

## Change discipline

Keep mechanical template/style extraction separate from behavior changes. Preserve selectors, inputs, outputs, route URLs, and API contracts during extraction. Every refactoring wave must pass formatting, architecture, lint, unit tests, E2E type checking, and the production build.
