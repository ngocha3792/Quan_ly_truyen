# Development environment

The repository uses one pinned JavaScript toolchain for local development, CI, and Docker builds.

## Required toolchain

- Node.js `24.15.0`
- npm `11.12.1`
- Docker Desktop / Docker Engine with Compose v2 for database, Redis, and container workflows

Node.js is pinned in both `.nvmrc` and `.node-version`. Frontend and backend package manifests enforce the supported Node/npm line through `engines`, while their `.npmrc` files enable `engine-strict`.

## Windows setup

From the repository root, select Node.js `24.15.0` with your Node version manager, then pin npm:

```powershell
npm install --global npm@11.12.1
```

Verify both applications see the expected runtime:

```powershell
npm --prefix frontend run env:check
npm --prefix backend run env:check
```

Install dependencies reproducibly:

```powershell
npm --prefix frontend ci
npm --prefix backend ci
```

Do not use `npm install` for routine setup when a committed `package-lock.json` is present. `npm ci` must remain the default for clean local setup and CI.

## Docker development

The backend development image is pinned to the same Node.js patch release as local development and CI. Start the backend development stack with:

```powershell
npm --prefix backend run docker:dev
```

Use `backend/docker/.env.docker.example` as the safe committed default. Keep any local secret override untracked.
