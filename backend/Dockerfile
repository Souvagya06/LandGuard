FROM node:20-bookworm-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY backend backend
COPY frontend frontend
COPY ml ml
RUN python3 -m pip install --break-system-packages --no-cache-dir -r backend/requirements.txt && cd frontend && npm run build

ENV NODE_ENV=production \
    PORT=8000 \
    MODEL_RUNTIME=python \
    PYTHON_BIN=python3
EXPOSE 8000
CMD ["node", "backend/server.js"]
