#!/bin/bash

echo "🏥 Performing health check on $DEPLOYMENT_URL"

# Basic connectivity test
if curl -f --max-time 30 "$DEPLOYMENT_URL" > /dev/null 2>&1; then
  echo "✅ App is responding"
else
  echo "❌ App is not responding"
  exit 1
fi

# Check response time
response_time=$(curl -o /dev/null -s -w '%{time_total}' "$DEPLOYMENT_URL")
echo "⏱️ Response time: ${response_time}s"

# Fail if response time is too slow (>10 seconds)
if (( $(echo "$response_time > 10" | bc -l) )); then
  echo "❌ Response time too slow: ${response_time}s"
  exit 1
fi

echo "✅ Health check passed"

