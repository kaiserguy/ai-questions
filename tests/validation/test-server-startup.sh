#!/bin/bash

echo "Testing server startup..."

# Test hosted server
echo "Testing hosted server startup..."
cd hosted
timeout 30s node index.cjs &
HOSTED_PID=$!
sleep 10

# Check if hosted server is responding
if curl -f http://localhost:3000/ > /dev/null 2>&1; then
  echo "✅ Hosted server started successfully"
else
  echo "❌ Hosted server failed to start or respond"
  kill $HOSTED_PID 2>/dev/null || true
  exit 1
fi

kill $HOSTED_PID 2>/dev/null || true
cd ..

# Test local server
echo "Testing local server startup..."
cd local
timeout 30s node local-app.js &
LOCAL_PID=$!
sleep 10

# Check if local server is responding
if curl -f http://localhost:3001/ > /dev/null 2>&1; then
  echo "✅ Local server started successfully"
else
  echo "❌ Local server failed to start or respond"
  kill $LOCAL_PID 2>/dev/null || true
  exit 1
fi

kill $LOCAL_PID 2>/dev/null || true
cd ..

echo "✅ All servers started successfully"

