# LandGuard Authority Control Center (landguard.online) + HTTPS reverse proxy
# for api.landguard.online. Build from the repository root:
#   docker build -f deploy/web.Dockerfile -t landguard-web .
FROM node:20-bookworm-slim AS build
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_URL=https://api.landguard.online
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /web/dist /srv/web
