# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base

WORKDIR /app

ENV CI=true
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        dumb-init \
        openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies

ENV NODE_ENV=development

# Prisma config yêu cầu DATABASE_URL trong postinstall.
# prisma generate không kết nối tới database này.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

COPY package.json package-lock.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma

RUN npm ci

FROM dependencies AS build

COPY . .

RUN npm run build
RUN npm run typecheck:scripts

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
ENV HOME=/tmp

COPY --from=production-dependencies \
    --chown=node:node \
    /app/node_modules \
    ./node_modules

COPY --from=build \
    --chown=node:node \
    /app/dist \
    ./dist

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