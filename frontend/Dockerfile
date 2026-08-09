ARG NODE_IMAGE=node:24.18.0-alpine
FROM ${NODE_IMAGE} AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci


FROM dependencies AS build

COPY . .

RUN npm run build:ci


FROM nginx:1.29-alpine AS runtime

COPY nginx/default.conf \
    /etc/nginx/conf.d/default.conf

COPY --from=build \
    /app/dist/frontend/browser \
    /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK \
    --interval=10s \
    --timeout=3s \
    --start-period=10s \
    --retries=5 \
    CMD wget -q -O /dev/null \
    http://127.0.0.1/health \
    || exit 1
