ARG NODE_IMAGE=node:24.18.0-bookworm-slim
FROM ${NODE_IMAGE} AS base

ARG NPM_VERSION=11.12.1

WORKDIR /app

ENV CI=true
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

RUN npm install --global "npm@${NPM_VERSION}" \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    dumb-init \
    openssl \
    && rm -rf /var/lib/apt/lists/*


FROM base AS dependencies

ENV NODE_ENV=development

# Prisma generate cần DATABASE_URL trong postinstall,
# nhưng không kết nối đến database này.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public

COPY package.json package-lock.json .npmrc ./
COPY prisma.config.ts ./
COPY prisma ./prisma

RUN npm config set registry https://registry.npmjs.org/ \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 300000 \
    && npm ci --no-audit --no-fund


FROM dependencies AS build

COPY . .

RUN npm run build \
    && npm run typecheck:scripts \
    && test -f dist/main.js \
    && test -f dist/worker.js \
    && test -f dist/healthcheck/worker-heartbeat.healthcheck.js \
    && test -f dist/healthcheck/recovery-metrics.js


FROM dependencies AS production-dependencies

RUN set -eux; \
    if [ -d /app/node_modules/.prisma ]; then \
    cp -R /app/node_modules/.prisma /tmp/prisma-generated; \
    fi; \
    npm prune --omit=dev --ignore-scripts; \
    if [ -d /tmp/prisma-generated ]; then \
    rm -rf /app/node_modules/.prisma; \
    mv /tmp/prisma-generated /app/node_modules/.prisma; \
    fi; \
    npm cache clean --force


FROM base AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV HOME=/tmp

COPY --from=production-dependencies \
    --chown=node:node \
    /app/node_modules \
    ./node_modules

COPY --from=build \
    --chown=node:node \
    /app/dist \
    ./dist

COPY --from=build \
    --chown=node:node \
    /app/prisma/migrations \
    ./prisma/migrations

COPY --chown=node:node \
    package.json \
    package-lock.json \
    ./

USER node

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/main.js"]


FROM build AS migrate

ENV NODE_ENV=production
ENV HOME=/tmp

USER node

ENTRYPOINT ["dumb-init", "--"]

CMD ["npm", "run", "db:migrate:deploy"]
