ARG NODE_IMAGE=node:24.18.0-alpine
FROM ${NODE_IMAGE} AS dependencies

ARG NPM_VERSION=11.12.1

WORKDIR /app

RUN npm install --global "npm@${NPM_VERSION}"

COPY package.json package-lock.json .npmrc ./

RUN npm ci


FROM dependencies AS build

COPY . .

RUN npm run build:ci


FROM dependencies AS production-dependencies

RUN npm prune --omit=dev


FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

COPY --from=production-dependencies \
    --chown=node:node \
    /app/node_modules \
    ./node_modules

COPY --from=build \
    --chown=node:node \
    /app/dist/frontend \
    ./dist/frontend

COPY --chown=node:node package.json ./package.json

USER node

EXPOSE 8080

HEALTHCHECK \
    --interval=10s \
    --timeout=3s \
    --start-period=15s \
    --retries=5 \
    CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/frontend/server/server.mjs"]
