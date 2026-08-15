# Auth test review and fixes

## Scope

This review covered the Auth unit tests, PostgreSQL and Redis integration tests, Auth outbox integration, HTTP E2E tests, test environment setup, Docker development configuration, and environment examples.

## Problems found

1. `test:auth:integration` and `test:auth:e2e` assumed that the test database already existed and had already been migrated.
2. The test safety guards were disabled when `ALLOW_UNSAFE_TEST_DB` was missing. Safe behavior should be the default.
3. `.env.example` pointed PostgreSQL URLs at host port `5432`, while `docker/compose.dev.yml` exposed PostgreSQL on host port `5433` by default.
4. Docker Compose referenced environment files that were not present in the submitted project.
5. The PostgreSQL init SQL contained a UTF-8 BOM.
6. The Auth PostgreSQL session-limit test used fixed expiration dates and did not explicitly control `createdAt`, although production logic selects the oldest session by `createdAt`.
7. `test:auth:unit` ran only two aggregate spec files and silently omitted eleven other Auth spec files.
8. `.env.example` contained duplicated or conflicting Auth values and an invalid mail payload encryption key.

## Changes applied

- Added `scripts/testing/prepare-auth-test-environment.ts`.
- Added `test:auth:prepare` and made integration/E2E scripts invoke it automatically.
- Added `test/jest-auth-unit.json`, so `test:auth:unit` includes every `src/modules/auth/**/*.spec.ts` file.
- Made database and Redis safety guards fail closed unless `ALLOW_UNSAFE_TEST_DB=true` is explicitly set.
- Added deterministic session limits to both integration and E2E setup.
- Reworked the session-limit integration fixture to use relative future expiration dates and explicit ordered `createdAt` values.
- Added tracked Docker-only defaults in `docker/.env.docker.example` and simplified Compose to load that file.
- Aligned host PostgreSQL example URLs with port `5433`.
- Removed the BOM from the PostgreSQL initialization SQL.
- Consolidated Auth example variables and supplied a valid 32-byte Base64 mail encryption key.
- Added local and Docker test instructions to the backend README.

## Verification performed in the review environment

- Parsed 697 TypeScript files with the TypeScript parser: no syntax diagnostics.
- Parsed `package.json` and `package-lock.json`: valid JSON.
- Confirmed dependency declarations match the root metadata in `package-lock.json`.
- Parsed both Docker Compose files as YAML.
- Confirmed `.env.example` and `docker/.env.docker.example` have no duplicate keys.
- Confirmed the PostgreSQL init SQL no longer begins with a UTF-8 BOM.

Full Jest execution could not be completed in the review container because its internal npm registry returned HTTP 404 for the locked `zeptomatch@2.1.0` tarball during `npm ci`. Docker, PostgreSQL, and Redis were also unavailable in that container. This limitation is external to the submitted source, so no passing test claim is made here.
