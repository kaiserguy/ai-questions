#!/bin/bash

echo "🏥 Performing health check on $DEPLOYMENT_URL"

# Basic connectivity test - allow redirects as they're expected for root route
echo "Testing basic connectivity..."
http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DEPLOYMENT_URL")
if [ "$http_code" = "200" ] || [ "$http_code" = "302" ] || [ "$http_code" = "301" ]; then
  echo "✅ App is responding (HTTP $http_code)"
else
  echo "❌ App is not responding (HTTP $http_code)"
  exit 1
fi

# Check response time
echo "Testing response time..."
response_time=$(curl -o /dev/null -s -w '%{time_total}' --max-time 30 "$DEPLOYMENT_URL")
echo "⏱️ Response time: ${response_time}s"

# Fail if response time is too slow (>10 seconds) - only if bc is available
if command -v bc >/dev/null 2>&1; then
  if (( $(echo "$response_time > 10" | bc -l) )); then
    echo "❌ Response time too slow: ${response_time}s"
    exit 1
  fi
else
  echo "ℹ️ bc not available, skipping response time validation"
fi

# Test specific endpoints
echo "Testing /offline endpoint..."
if curl -f -s --max-time 10 "$DEPLOYMENT_URL/offline" > /dev/null 2>&1; then
  echo "✅ /offline endpoint accessible"
else
  echo "⚠️ /offline endpoint may have issues"
fi

echo "✅ Health check passed"

