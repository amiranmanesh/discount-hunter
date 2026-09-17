# syntax=docker/dockerfile:1.7

# One image, one process: the Next.js server that renders the app *and* forwards
# `/api/*` to Snapp Market, Digikala Jet and Okala.
#
# The two cannot be separated. None of the three platforms allows a cross-origin
# browser request, so the page and its proxy have to answer on the same origin —
# which is also why this image works unchanged on localhost, on a personal
# domain, and behind any reverse proxy: there is no origin to configure.
#
# Both images are build arguments so a build on a restricted network can pull
# from a mirror, e.g.
#   docker build --build-arg NODE_IMAGE=hub.hamdocker.ir/node:22-alpine \
#                --build-arg NPM_REGISTRY=https://registry.npmmirror.com .
ARG NODE_IMAGE=node:22-alpine

# ---------------------------------------------------------------- base -----
FROM ${NODE_IMAGE} AS base
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

ARG NPM_REGISTRY=https://registry.npmjs.org
ENV npm_config_registry=${NPM_REGISTRY}

# ------------------------------------------------------- dependencies ------
# Split from the build so a source-only change does not reinstall anything.
FROM base AS dependencies
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=cache,id=discount-hunter-npm,target=/root/.npm \
    npm ci --no-audit --no-fund

# ------------------------------------------------------------- build -------
FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# The only build-time variable this app has, and it is almost always empty:
# `/api` on its own origin is the default and what every normal deploy uses.
# It is inlined into the bundle, so it cannot be changed at runtime.
ARG NEXT_PUBLIC_API_BASE=""
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}

RUN npm run build

# ----------------------------------------------------------- runtime -------
# `output: 'standalone'` traces every module the server actually needs into
# `.next/standalone`, so this stage carries no `node_modules` of its own.
FROM ${NODE_IMAGE} AS runtime

LABEL org.opencontainers.image.source="https://github.com/amiranmanesh/discount-hunter" \
      org.opencontainers.image.documentation="https://github.com/amiranmanesh/discount-hunter/blob/main/docs/DEPLOY.md" \
      org.opencontainers.image.title="Discount Hunter" \
      org.opencontainers.image.description="Every Snapp Market, Digikala Jet and Okala discount near you, deepest first." \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # Docker sets HOSTNAME to the container id, and the standalone server would
    # bind to that name and become unreachable. Pin the bind address.
    HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

# Reports on this process only — never on whether Snapp Market happens to be up,
# so an upstream outage can never cause a restart loop.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
