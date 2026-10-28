# ==========================================
# VehicleVault — Multi-Stage Production Dockerfile
# ==========================================

# Stage 1: Build Frontend PWA
FROM node:24-bookworm-slim AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build Backend TypeScript
FROM node:24-bookworm-slim AS server-builder
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm install
COPY server/ ./server/
RUN npm run build --workspace=server

# Stage 3: Production Runtime
FROM node:24-bookworm-slim AS runner
WORKDIR /app

# Install runtime dependencies (ca-certificates for HTTPS/RDW API, curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data

# Create persistent storage mount directories
RUN mkdir -p /data/receipts /data/invoices /data/documents /data/vehicles /data/logs

# Copy server dependencies and built artifacts
COPY server/package*.json ./
RUN npm install --omit=dev

COPY --from=server-builder /app/server/dist ./dist
COPY --from=client-builder /app/client/dist ./client/dist

# Expose HTTP port
EXPOSE 3001

# Declare persistent volume
VOLUME ["/data"]

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/healthz || exit 1

# Start the unified VehicleVault server (serving REST API, MCP, and PWA)
CMD ["node", "dist/index.js"]
