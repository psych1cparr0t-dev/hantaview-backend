# ── Stage 1: build (needs python3/make/g++ for better-sqlite3) ────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /build
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 2: runtime (clean Alpine, no build tools) ───────────────────────────
FROM node:20-alpine

RUN addgroup -S hantaview && adduser -S hantaview -G hantaview

WORKDIR /app

# Copy pre-built node_modules from builder
COPY --from=builder /build/node_modules ./node_modules

COPY src/    ./src/
COPY public/ ./public/

RUN mkdir -p logs data && chown -R hantaview:hantaview /app

USER hantaview

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/index.js"]
