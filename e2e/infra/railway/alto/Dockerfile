# Alto bundler for Railway PR environments.
#
# Railway image-based services can't mount config files, so this thin wrapper
# bakes in a Railway-specific config that points at anvil over the
# environment's private network (anvil.railway.internal).
#
# Railway service settings:
#   Root Directory:  e2e/infra
#   Dockerfile Path: railway/alto/Dockerfile
FROM ghcr.io/pimlicolabs/alto:latest

COPY railway/alto/alto-config.railway.json /app/alto-config.json
COPY alto/wait-for-anvil.mjs /app/wait-for-anvil.mjs
COPY alto/healthcheck.mjs /app/healthcheck.mjs

ENV ANVIL_RPC=http://anvil.railway.internal:8545

EXPOSE 4337

ENTRYPOINT ["sh", "-c"]
CMD ["node /app/wait-for-anvil.mjs && exec node src/lib/cli/alto.js run --config /app/alto-config.json"]
