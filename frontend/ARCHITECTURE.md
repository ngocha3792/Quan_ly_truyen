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

Component classes have a 500-line hard cap and a 250-line target. Stores have a 600-line hard cap and a 300-line target. Their excess-line totals are tracked independently so splitting one large class cannot hide growth in another. New code should meet the target; legacy files above it may only shrink.

## Strict compilation

Application and test TypeScript compile with `strict`. Angular templates compile with `strictTemplates`, strict injection parameters, and strict input access modifiers. Redundant optional chaining in templates is promoted to an error through extended diagnostics.

Do not suppress strict errors with broad casts or `any`. Narrow values at their boundary and keep template guards aligned with the types rendered inside each control-flow block.

## Regression suite

The unit suite protects cross-tab auth coordination, root route composition and private-route guards, and the shared icon registry. When changing one of these infrastructure contracts, extend the corresponding regression test before changing its implementation.

## Mechanical asset extraction

Use `node scripts/extract-inline-component-assets.mjs <feature-path>` for a dry run, then add
`--write` to extract static inline templates and styles into co-located `.html` and `.scss` files.
The script refuses to overwrite existing assets and rejects interpolated TypeScript template
literals, so those cases must be reviewed manually.

## Change discipline

Keep mechanical template/style extraction separate from behavior changes. Preserve selectors, inputs, outputs, route URLs, and API contracts during extraction. Every refactoring wave must pass formatting, architecture, lint, unit tests, E2E type checking, and the production build.
