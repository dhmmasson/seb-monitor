# ============================================================
# SEB Monitor — Multi-stage Dockerfile
# ============================================================
# Stage 1: Build the client IIFE bundle
# Stage 2: Production Deno server
# ============================================================

# --- Stage 1: Build client ---
FROM denoland/deno:alpine AS builder

WORKDIR /build

# Copy client build files
COPY client/deno.json client/deno.lock* ./client/
COPY client/build.ts ./client/
COPY client/src/ ./client/src/
COPY shared/ ./shared/

# Build the client IIFE bundle
RUN deno run -A client/build.ts

# --- Stage 2: Production ---
FROM denoland/deno:alpine

# Labels
LABEL maintainer="SEB Monitor"
LABEL description="Exam Activity Monitoring Server"
LABEL version="0.4.0"

WORKDIR /app

# Copy server source + shared types
COPY server/ ./server/
COPY shared/ ./shared/

# Copy built client from builder stage
COPY --from=builder /build/client/dist/seb-monitor.js ./client/dist/seb-monitor.js

# Copy demo files (exam.html served as static)
COPY docs/demos/exam.html ./docs/demos/exam.html

# Create data directory for SQLite
RUN mkdir -p /data

# Environment variables (overridable at runtime)
ENV PORT=8000
ENV DB_PATH=/data/seb-monitor.db
ENV COOKIE_SECRET=change-me-in-production

# Expose the server port
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1

# Start the server
CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "server/src/main.ts"]
