# SocietyOS backend — production container image (Lightsail / any OCI runtime).
#
# Build from the REPOSITORY ROOT — the pnpm monorepo workspace is the build
# context (a --frozen-lockfile install needs every workspace package.json):
#
#   docker build -f backend/Dockerfile -t societyos-backend:dev .
#
# Entry: dist/main.container.js — always-on server (HTTP + websockets +
# in-process BullMQ worker). Load-balancer health check: GET /v1/health.

FROM node:20-slim

# openssl        → required by the Prisma query engine
# ca-certificates → outbound TLS (Marzi auth API, AWS SDK, Razorpay)
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /repo

# Whole repo as context. --filter narrows the actual install to the backend
# and its dependencies; the other workspace packages are only needed so the
# frozen lockfile resolves.
COPY . .
RUN pnpm install --frozen-lockfile --filter @societyos/backend...

WORKDIR /repo/backend
RUN pnpm exec prisma generate \
 && pnpm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Run as the image's built-in unprivileged user.
USER node

CMD ["node", "dist/main.container"]
