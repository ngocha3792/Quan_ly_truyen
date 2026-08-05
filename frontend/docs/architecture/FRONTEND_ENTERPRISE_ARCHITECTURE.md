# Frontend enterprise architecture

## Dependency direction

`app -> layouts/features -> domains/core/shared`

- **core**: singleton infrastructure, HTTP, auth, configuration and cross-cutting services.
- **domains**: business contracts, models, mappers, APIs and stores. It must not import feature UI.
- **shared**: stateless UI primitives, directives, pipes and generic utilities. It must not know any domain or feature.
- **layouts**: reusable route shells. They render navigation, headers and `router-outlet`, but contain no business data.
- **features**: vertical business slices. Each feature owns routes, feature configuration, facade/state and leaf pages.

## Feature contract

Each migrated feature follows:

`config / layouts / pages / state / styles / <feature>.routes.ts`

- A route loads one leaf page instead of a giant page with `@switch`.
- A feature layout only configures a shared route shell.
- Mutable UI state and mock data are scoped through a feature facade provider.
- The temporary `*-view-model.ts` adapter preserves existing templates while state is moved out of components. New code should inject the facade directly.
- Shared visual behavior is applied through `ButtonDirective`, `CardDirective`, `DataTableDirective` and `StatusBadgeDirective`.

## Enforcement

Run `npm run lint:boundaries` to reject imports that violate layer direction or cross feature boundaries.
Run `npm run verify:enterprise` before merging.

## Next production step

The current facade data is still mock/demo data inherited from the original screens. Replace each mock collection with domain APIs/stores incrementally; do not move business-specific models into `shared`.
