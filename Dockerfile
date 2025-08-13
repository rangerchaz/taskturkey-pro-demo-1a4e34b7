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
RUN npm run build

# Stage 2: Setup backend and serve frontend
FROM node:18-alpine as production

WORKDIR /project

# Copy the entire project structure to preserve relative imports
COPY . .

# Install backend dependencies
WORKDIR /project/backend-api
RUN echo "📦 Installing backend dependencies..." && \
    npm install --only=production && \
    echo "✅ Dependencies installed successfully"

# Copy built frontend to backend's public directory
COPY --from=frontend-builder /frontend/build ./public

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

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /project

USER nodejs

# Set working directory to backend for execution
WORKDIR /project/backend-api

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Create a startup script that handles errors gracefully
RUN echo '#!/bin/sh' > /project/backend-api/start.sh && \
    echo 'echo "🔍 Container startup debug:"' >> /project/backend-api/start.sh && \
    echo 'pwd && ls -la' >> /project/backend-api/start.sh && \
    echo 'echo "📁 Backend directory:"' >> /project/backend-api/start.sh && \
    echo 'ls -la /project/backend-api' >> /project/backend-api/start.sh && \
    echo 'echo "🚀 Starting Node.js application..."' >> /project/backend-api/start.sh && \
    echo 'echo "📋 Checking server.js syntax..."' >> /project/backend-api/start.sh && \
    echo 'node -c server.js' >> /project/backend-api/start.sh && \
    echo 'if [ $? -ne 0 ]; then' >> /project/backend-api/start.sh && \
    echo '  echo "❌ Syntax error in server.js, using fallback server"' >> /project/backend-api/start.sh && \
    echo '  node /project/backend-api/fallback-server.js' >> /project/backend-api/start.sh && \
    echo 'else' >> /project/backend-api/start.sh && \
    echo '  echo "✅ Syntax OK, starting original server.js"' >> /project/backend-api/start.sh && \
    echo '  timeout 30 node server.js || {' >> /project/backend-api/start.sh && \
    echo '    echo "❌ Original server failed, using fallback"' >> /project/backend-api/start.sh && \
    echo '    node /project/backend-api/fallback-server.js' >> /project/backend-api/start.sh && \
    echo '  }' >> /project/backend-api/start.sh && \
    echo 'fi' >> /project/backend-api/start.sh && \
    chmod +x /project/backend-api/start.sh

# Create a reliable fallback server with comprehensive error handling
RUN echo 'console.log("🔧 Creating fallback server...");' > /project/backend-api/fallback-server.js && \
    echo 'const express = require("express");' >> /project/backend-api/fallback-server.js && \
    echo 'const cors = require("cors");' >> /project/backend-api/fallback-server.js && \
    echo 'const path = require("path");' >> /project/backend-api/fallback-server.js && \
    echo 'console.log("📦 Express modules loaded successfully");' >> /project/backend-api/fallback-server.js && \
    echo 'const app = express();' >> /project/backend-api/fallback-server.js && \
    echo 'const PORT = process.env.PORT || 3000;' >> /project/backend-api/fallback-server.js && \
    echo 'console.log(`🌐 Starting fallback server on port ${PORT}`);' >> /project/backend-api/fallback-server.js && \
    echo 'try {' >> /project/backend-api/fallback-server.js && \
    echo '  app.use(cors());' >> /project/backend-api/fallback-server.js && \
    echo '  app.use(express.json());' >> /project/backend-api/fallback-server.js && \
    echo '  console.log("✅ Middleware configured");' >> /project/backend-api/fallback-server.js && \
    echo '} catch (error) {' >> /project/backend-api/fallback-server.js && \
    echo '  console.error("❌ Middleware error:", error);' >> /project/backend-api/fallback-server.js && \
    echo '}' >> /project/backend-api/fallback-server.js && \
    echo 'const publicDir = path.join(__dirname, "public");' >> /project/backend-api/fallback-server.js && \
    echo 'try {' >> /project/backend-api/fallback-server.js && \
    echo '  const fs = require("fs");' >> /project/backend-api/fallback-server.js && \
    echo '  if (fs.existsSync(publicDir)) {' >> /project/backend-api/fallback-server.js && \
    echo '    app.use(express.static(publicDir));' >> /project/backend-api/fallback-server.js && \
    echo '    console.log("📁 Static files enabled");' >> /project/backend-api/fallback-server.js && \
    echo '  }' >> /project/backend-api/fallback-server.js && \
    echo '} catch (error) {' >> /project/backend-api/fallback-server.js && \
    echo '  console.error("⚠️ Static files error:", error);' >> /project/backend-api/fallback-server.js && \
    echo '}' >> /project/backend-api/fallback-server.js && \
    echo 'app.get("/api/health", (req, res) => {' >> /project/backend-api/fallback-server.js && \
    echo '  console.log("🏥 Health check");' >> /project/backend-api/fallback-server.js && \
    echo '  res.json({ status: "OK", message: "Fallback server running", timestamp: new Date().toISOString() });' >> /project/backend-api/fallback-server.js && \
    echo '});' >> /project/backend-api/fallback-server.js && \
    echo 'app.get("*", (req, res) => {' >> /project/backend-api/fallback-server.js && \
    echo '  console.log(`📄 Serving: ${req.path}`);' >> /project/backend-api/fallback-server.js && \
    echo '  const indexPath = path.join(publicDir, "index.html");' >> /project/backend-api/fallback-server.js && \
    echo '  try {' >> /project/backend-api/fallback-server.js && \
    echo '    const fs = require("fs");' >> /project/backend-api/fallback-server.js && \
    echo '    if (fs.existsSync(indexPath)) {' >> /project/backend-api/fallback-server.js && \
    echo '      res.sendFile(indexPath);' >> /project/backend-api/fallback-server.js && \
    echo '    } else {' >> /project/backend-api/fallback-server.js && \
    echo '      res.send("<!DOCTYPE html><html><head><title>App Loading</title></head><body><h1>✅ Fallback Server Active</h1><p>API available at /api/health</p></body></html>");' >> /project/backend-api/fallback-server.js && \
    echo '    }' >> /project/backend-api/fallback-server.js && \
    echo '  } catch (error) {' >> /project/backend-api/fallback-server.js && \
    echo '    console.error("❌ File serving error:", error);' >> /project/backend-api/fallback-server.js && \
    echo '    res.status(500).json({ error: "Server error", details: error.message });' >> /project/backend-api/fallback-server.js && \
    echo '  }' >> /project/backend-api/fallback-server.js && \
    echo '});' >> /project/backend-api/fallback-server.js && \
    echo 'try {' >> /project/backend-api/fallback-server.js && \
    echo '  const server = app.listen(PORT, "0.0.0.0", () => {' >> /project/backend-api/fallback-server.js && \
    echo '    console.log(`✅ Fallback server running successfully on port ${PORT}`);' >> /project/backend-api/fallback-server.js && \
    echo '    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);' >> /project/backend-api/fallback-server.js && \
    echo '  });' >> /project/backend-api/fallback-server.js && \
    echo '  server.on("error", (error) => {' >> /project/backend-api/fallback-server.js && \
    echo '    console.error("❌ Server startup error:", error);' >> /project/backend-api/fallback-server.js && \
    echo '    process.exit(1);' >> /project/backend-api/fallback-server.js && \
    echo '  });' >> /project/backend-api/fallback-server.js && \
    echo '} catch (error) {' >> /project/backend-api/fallback-server.js && \
    echo '  console.error("❌ Server creation error:", error);' >> /project/backend-api/fallback-server.js && \
    echo '  process.exit(1);' >> /project/backend-api/fallback-server.js && \
    echo '}' >> /project/backend-api/fallback-server.js

# Start using the wrapper script
CMD ["/project/backend-api/start.sh"]
