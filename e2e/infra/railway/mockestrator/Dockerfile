# Rhinestone mockestrator for Railway PR environments.
#
# Wraps the upstream image to bake in config files (Railway can't mount
# files into image-based services) with the RPC pointed at anvil over the
# environment's private network.
#
# Railway service settings:
#   Root Directory:  e2e/infra
#   Dockerfile Path: railway/mockestrator/Dockerfile
FROM ghcr.io/ensdomains/mockestrator:latest

COPY railway/mockestrator/rpcs.railway.json /app/rpcs.json
COPY mockestrator/chains.json /app/chains.json

EXPOSE 3000
