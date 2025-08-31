#!/bin/bash

echo "🛤️ Validating critical user paths"

# Test homepage (expect redirect to login)
echo "Testing homepage..."
http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DEPLOYMENT_URL/")
if [ "$http_code" = "200" ] || [ "$http_code" = "302" ] || [ "$http_code" = "301" ]; then
  echo "✅ Homepage accessible (HTTP $http_code)"
else
  echo "❌ Homepage failed (HTTP $http_code)"
  exit 1
fi

# Test offline page (the critical feature)
echo "Testing offline page..."
if curl -f --max-time 30 "$DEPLOYMENT_URL/offline/" > /dev/null 2>&1; then
  echo "✅ Offline page accessible"
else
  echo "⚠️ Offline page with trailing slash may have issues, trying without slash..."
fi

# Test offline page without trailing slash
echo "Testing offline page (no trailing slash)..."
if curl -f --max-time 30 "$DEPLOYMENT_URL/offline" > /dev/null 2>&1; then
  echo "✅ Offline page (no slash) accessible"
else
  echo "❌ Offline page (no slash) failed"
  exit 1
fi

# Test login page if available
echo "Testing login page..."
if curl -f --max-time 30 "$DEPLOYMENT_URL/login" > /dev/null 2>&1; then
  echo "✅ Login page accessible"
else
  echo "⚠️ Login page may have issues (not critical for core functionality)"
fi

echo "✅ All critical paths accessible"

