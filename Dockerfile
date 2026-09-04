# syntax=docker/dockerfile:1

# The app cannot be hosted as static files: neither Snapp Market nor Digikala Jet
# allows a cross-origin browser request, so the bundle has to be served next to
# the proxy that fronts them. That is what this image is — one process serving
# `dist/` and forwarding `/api/*`.

# ---------------------------------------------------------------- build ----
FROM node:22-alpine AS build

WORKDIR /app

# Dependencies first, so a source-only change does not reinstall them.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY tsconfig*.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY server ./server

RUN npm run build

# -------------------------------------------------------------- runtime ----
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=4173 \
    HOST=0.0.0.0

WORKDIR /app

# The server uses only Node built-ins, so the runtime image carries no
# node_modules at all — just the bundle, the server, and `"type": "module"`.
COPY --from=build /app/dist ./dist
COPY server ./server
COPY package.json ./package.json

USER node
EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4173)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
