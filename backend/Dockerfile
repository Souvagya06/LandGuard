# LandGuard API (api.landguard.online). Build from the repository root:
#   docker build -f backend/Dockerfile -t landguard-api .
FROM node:20-bookworm-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev
COPY backend/requirements.txt backend/
RUN python3 -m pip install --break-system-packages --no-cache-dir -r backend/requirements.txt

COPY backend backend
# Only the trained artifacts and inference bridge — never the raw training data.
COPY ml/models ml/models
COPY ml/scripts ml/scripts

RUN useradd --system --home /app landguard && mkdir -p /data && chown landguard /data
USER landguard

ENV NODE_ENV=production \
    PORT=8000 \
    MODEL_RUNTIME=python \
    PYTHON_BIN=python3 \
    LANDGUARD_DATA_DIR=/data \
    SERVE_FRONTEND=false \
    TRUST_PROXY=1
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/server.js"]
