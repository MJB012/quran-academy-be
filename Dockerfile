# syntax=docker/dockerfile:1

############################
# Base image
############################
FROM node:22-bookworm-slim AS base
WORKDIR /app
# dumb-init gives us proper PID 1 signal handling (clean SIGTERM on `docker stop`)
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/*

############################
# Install ALL deps (incl. dev) — used to compile TypeScript.
# Build toolchain is needed here so bcrypt's native addon can build.
############################
FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci

############################
# Build the Nest app -> dist/
############################
FROM deps AS build
COPY . .
RUN npm run build

############################
# Production dependencies only (pruned, no dev deps)
############################
FROM base AS prod-deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

############################
# Final runtime image — slim, non-root
############################
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

EXPOSE 3000

# Run as the unprivileged `node` user that ships with the base image.
USER node

# Container-level health check hitting the public Swagger endpoint (returns 200).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/docs',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
