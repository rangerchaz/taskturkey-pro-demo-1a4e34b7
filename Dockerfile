# Multi-stage build for full-stack application

# Stage 1: Build frontend
FROM node:18-alpine as frontend-builder

WORKDIR /frontend

# Copy frontend package files
COPY frontend-app/package*.json ./

# Install frontend dependencies
RUN npm install

# Copy frontend source
COPY frontend-app/ ./

# Build the React app
RUN npm run build && \
    echo "📁 Contents of /frontend after build:" && \
    ls -la /frontend/ && \
    echo "📁 Contents of /frontend/build (if exists):" && \
    ls -la /frontend/build/ || echo "No build directory found"

# Stage 2: Setup backend and serve frontend
FROM node:18-alpine as production

# Install wget for health checks
RUN apk add --no-cache wget

WORKDIR /project

# Copy the entire project structure to preserve relative imports
COPY . .

# Install backend dependencies
WORKDIR /project/backend-api
RUN echo "📦 Installing backend dependencies..." && \
    npm install --only=production && \
    echo "✅ Dependencies installed successfully"

# Create non-root user FIRST
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built frontend to backend's public directory
COPY --from=frontend-builder /frontend/build ./public

# Fix ownership of everything including the newly copied files
RUN chown -R nodejs:nodejs /project

# Debug: Check if public directory has the React build
RUN echo "📁 Contents of /project/backend-api/public after copying React build:" && \
    ls -la /project/backend-api/public/ || echo "Public directory not found or empty"

# Verify installation
RUN echo "🔍 Verifying installation..." && \
    node --version && \
    npm --version && \
    echo "📁 Project structure:" && \
    ls -la /project && \
    echo "📁 Backend directory:" && \
    ls -la /project/backend-api && \
    echo "📁 Public directory:" && \
    ls -la /project/backend-api/public

USER nodejs

# Set working directory to backend for execution
WORKDIR /project/backend-api

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Remove fallback server - we'll run the main server directly

# Force rebuild with timestamp
RUN echo "Build timestamp: $(date)" > /project/backend-api/build-info.txt

# Start the server directly with explicit path
CMD ["node", "/project/backend-api/server.js"]
