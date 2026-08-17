# Panoptes ENS indexer + GraphQL API for Railway PR environments.
#
# In docker-compose these are two containers sharing the `panoptes-data`
# volume. Railway volumes can't be shared between services, so this wrapper
# runs both processes in ONE container: the indexer writes the sqlite DB and
# the API reads it from the same filesystem.
#
# Railway service settings:
#   Root Directory:  e2e/infra
#   Dockerfile Path: railway/panoptes/Dockerfile
FROM ghcr.io/mdtanrikulu/panoptes:latest

COPY railway/panoptes/entrypoint.sh /app/railway-entrypoint.sh
COPY panoptes/contracts.snapshot.json /app/config/contracts.json

# Shared by indexer and API (same container, same disk).
ENV DATABASE_PATH=/app/data/ens_v2.db \
    RAINBOW_PATH=/app/data/ens_rainbow.db \
    NETWORK=sepolia \
    CONTRACTS_PATH=/app/config/contracts.json \
    RPC_URL=http://anvil.railway.internal:8545 \
    BATCH_SIZE=10000 \
    POLL_INTERVAL=2 \
    RATE_LIMIT_PER_SECOND=100 \
    STATUS_PORT=3001 \
    WEBHOOKS_ENABLED=false \
    DOWNLOAD_RAINBOW=false \
    API_PORT=5655 \
    GRAPHQL_MAX_DEPTH=10 \
    GRAPHQL_MAX_COST=1000 \
    METRICS_ENABLED=false

EXPOSE 5655

ENTRYPOINT ["/bin/sh", "/app/railway-entrypoint.sh"]
