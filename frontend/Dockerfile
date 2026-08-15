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


FROM nginx:1.29-alpine AS runtime

COPY nginx/nginx.conf \
    /etc/nginx/nginx.conf

COPY nginx/default.conf \
    /etc/nginx/conf.d/default.conf

COPY --from=build \
    --chown=nginx:nginx \
    /app/dist/frontend/browser \
    /usr/share/nginx/html

# The runtime does not need root: nginx listens on an unprivileged port and
# writes its pid/temp files below /tmp so the filesystem can stay read-only.
USER nginx

EXPOSE 8080

HEALTHCHECK \
    --interval=10s \
    --timeout=3s \
    --start-period=10s \
    --retries=5 \
    CMD wget -q -O /dev/null \
    http://127.0.0.1:8080/health \
    || exit 1

# Bypass the image entrypoint scripts: production configuration is baked into
# the image and must not be mutated at container startup.
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
