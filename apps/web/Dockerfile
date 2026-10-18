# syntax=docker/dockerfile:1
#
# DevFlow web app (Next.js standalone server). Build from apps/web:
#   docker build --build-arg API_BASE_URL=http://api:8080 -t devflow-web .
#
# API_BASE_URL is baked in at build time: Next.js resolves rewrites (/api, /hubs) during
# `next build`. It is server-side only and never shipped to the browser.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
ARG API_BASE_URL
RUN test -n "$API_BASE_URL" || (echo "Pass --build-arg API_BASE_URL (e.g. http://api:8080)" && exit 1)
ENV API_BASE_URL=$API_BASE_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# The standalone output contains only the files the server needs, including a trimmed node_modules.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
