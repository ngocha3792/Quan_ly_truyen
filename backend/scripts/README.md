# Backend Scripts

Run commands from `backend/`.

## Safety

- Maintenance commands are dry-run unless `--apply` is passed.
- Database reset requires `--confirm-reset`.
- Never log or commit secrets.
- Run database migrations before seed verification.

## Commands

| Command | Purpose |
|---|---|
| `npm run ci:check-env` | Validate required environment |
| `npm run db:check` | Check PostgreSQL connection |
| `npm run db:reset:local -- --confirm-reset` | Reset local DB and seed |
| `npm run db:verify:constraints` | Verify manual indexes/constraints |
| `npm run db:verify:seed` | Verify roles and permissions |
| `npm run admin:create -- ...` | Create/upgrade initial admin |
| `npm run maintenance:auth-cleanup` | Report expired auth records |
| `npm run maintenance:story-counters` | Report counter mismatches |
