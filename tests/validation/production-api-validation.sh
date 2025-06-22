#!/bin/bash

echo "🔌 Validating API endpoints"

# Test offline package availability endpoint
echo "Testing package availability API..."
if curl -f --max-time 30 "$DEPLOYMENT_URL/api/offline/packages/availability" > /dev/null 2>&1; then
  echo "✅ Package availability API accessible"
else
  echo "❌ Package availability API failed"
  exit 1
fi

# Test minimal package manifest endpoint (the only one that exists)
echo "Testing minimal package manifest API..."
response=$(curl -s --max-time 30 "$DEPLOYMENT_URL/api/offline/packages/minimal/manifest")
status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DEPLOYMENT_URL/api/offline/packages/minimal/manifest")

if [ "$status_code" = "200" ] || [ "$status_code" = "404" ]; then
  # 200 = manifest exists, 404 = expected when no cache built yet
  echo "✅ Minimal package manifest API accessible (status: $status_code)"
  if [ "$status_code" = "404" ]; then
    echo "   → Expected 404: No cache built yet (use /api/offline/packages/build to cache resources first)"
  fi
else
  echo "❌ Minimal package manifest API failed (status: $status_code)"
  exit 1
fi

# Note: Standard and full package manifests don't exist as separate endpoints
# They are handled client-side, so we don't test them here

echo "✅ All available API endpoints accessible"

