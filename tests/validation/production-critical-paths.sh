#!/bin/bash

echo "🛤️ Validating critical user paths"

# Test homepage
if curl -f --max-time 30 "$DEPLOYMENT_URL/" > /dev/null 2>&1; then
  echo "✅ Homepage accessible"
else
  echo "❌ Homepage failed"
  exit 1
fi

# Test offline page (the critical feature)
if curl -f --max-time 30 "$DEPLOYMENT_URL/offline/" > /dev/null 2>&1; then
  echo "✅ Offline page accessible"
else
  echo "❌ Offline page failed"
  exit 1
fi

# Test offline page without trailing slash
if curl -f --max-time 30 "$DEPLOYMENT_URL/offline" > /dev/null 2>&1; then
  echo "✅ Offline page (no slash) accessible"
else
  echo "❌ Offline page (no slash) failed"
  exit 1
fi

echo "✅ All critical paths accessible"

