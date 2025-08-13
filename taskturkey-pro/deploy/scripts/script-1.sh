#!/bin/bash
# Emergency rollback script

set -e

CONTAINER_NAME="taskturkey-app"
BACKUP_IMAGE="taskturkey-pro:backup"

echo "🔄 Rolling back TaskTurkey Pro..."

# Stop current container
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Start backup version
docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p 3000:3000 \
    --env-file .env \
    "$BACKUP_IMAGE" || {
    echo "❌ Rollback failed!"
    exit 1
}

echo "✅ Rollback completed successfully!"