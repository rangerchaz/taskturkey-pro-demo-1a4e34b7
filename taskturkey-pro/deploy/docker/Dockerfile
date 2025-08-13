# Multi-stage build optimized for HTML/CSS/JS frontend with Node.js backend
FROM node:18-alpine AS base

# Install dependencies for both frontend and backend
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Frontend build stage (minimal for HTML/CSS/JS)
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY src/frontend/ ./
# No build step needed for vanilla HTML/CSS/JS - just copy files

# Production stage
FROM node:18-alpine AS production

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S taskturkey -u 1001

WORKDIR /app

# Copy backend dependencies
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./

# Copy backend source
COPY src/backend/ ./

# Copy frontend assets to be served by backend
COPY --from=frontend-build /app/frontend ./public/

# Copy tests for health checks
COPY tests/ ./tests/

# Set ownership to non-root user
RUN chown -R taskturkey:nodejs /app
USER taskturkey

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Expose port
EXPOSE 3000

# Production optimizations
ENV NODE_ENV=production
ENV PORT=3000

# Start application
CMD ["node", "server.js"]