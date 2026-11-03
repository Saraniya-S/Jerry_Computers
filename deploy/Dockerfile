# The website image. Built by deploy/docker-compose.yml; see DEPLOY.md ("Docker").
# The build prerenders the home page from the database, so it runs on the host network with the
# database already up, and reads the settings from a build secret (never stored in the image).

FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Source plus every package, including the migration tool. Also the image that runs migrations.
FROM base AS migrate
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
CMD ["node", "node_modules/drizzle-kit/bin.cjs", "migrate"]

FROM migrate AS build
RUN --mount=type=secret,id=app_env,target=/app/.env.local NODE_ENV=production npm run build

FROM base AS app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
# Uploaded photos live on a volume mounted here.
RUN mkdir -p /data/uploads && chown node:node /data/uploads
ENV UPLOAD_DIR=/data/uploads
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3000"]
