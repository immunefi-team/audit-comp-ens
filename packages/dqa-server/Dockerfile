# DQA overlay service. Standalone image: the package has no workspace deps,
# so the build context is just this directory (see e2e/infra/docker-compose.yml).
# Server TypeScript runs directly via Node's native type stripping (>=22.18) —
# no transpile step for server/. The browser overlay IS bundled: Vite compiles
# client/overlay.js into dist/, splitting html-to-image into a lazy chunk.
#
#   docker build -t dqa-server packages/dqa-server
#   docker run -p 4000:4000 -v dqa-data:/app/data --env-file .env dqa-server

# ---- build stage: bundle the browser overlay -------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./
# `typescript` uses pnpm's `catalog:` protocol, which plain npm can't parse —
# and Vite strips types itself, so the build doesn't need it. Every other
# devDependency (vite, html-to-image, @types/*) is pinned to real semver
# precisely so this stage can install with plain npm.
RUN npm pkg delete devDependencies.typescript \
  && npm install --no-audit --no-fund

COPY vite.config.ts ./
COPY client ./client
RUN npm run build

# ---- runtime stage ---------------------------------------------------------
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
# Runtime needs only the prod deps (hono/@hono/node-server/ws); TypeScript runs via
# Node's native type stripping, no transpile. devDependencies use pnpm's
# `catalog:` protocol which plain npm can't parse, so strip them first — the
# image never needs them.
RUN npm pkg delete devDependencies && npm install --omit=dev --no-audit --no-fund

COPY server ./server
COPY public ./public
# Built overlay bundle + its chunks. server/index.ts serves this ahead of
# public/, so the URL stays /overlay.js.
COPY --from=build /app/dist ./dist

# Comments + uploads live here; mount a volume (docker run -v / compose
# volumes / Railway Volumes) to persist across restarts. No VOLUME
# instruction: Railway rejects it, and mounts don't need it declared.
RUN mkdir -p /app/data/uploads

ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -q --spider http://localhost:4000/auth/config || exit 1

CMD ["node", "server/index.ts"]
