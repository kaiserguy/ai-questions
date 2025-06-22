#!/bin/bash

echo "Testing critical routes..."

cd hosted
timeout 30s node index.cjs &
SERVER_PID=$!
sleep 10

# Test critical routes
routes=("/" "/offline" "/offline/")

for route in "${routes[@]}"; do
  if curl -f "http://localhost:3000$route" > /dev/null 2>&1; then
    echo "✅ Route $route accessible"
  else
    echo "❌ Route $route failed"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
  fi
done

kill $SERVER_PID 2>/dev/null || true
cd ..

echo "✅ All critical routes accessible"

