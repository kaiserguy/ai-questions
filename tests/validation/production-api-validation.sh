#!/bin/bash

echo "🔌 Validating API endpoints"

# Test offline package availability endpoint
if curl -f --max-time 30 "$DEPLOYMENT_URL/api/offline/packages/availability" > /dev/null 2>&1; then
  echo "✅ Package availability API accessible"
else
  echo "❌ Package availability API failed"
  exit 1
fi

# Test package manifest endpoints
packages=("minimal" "standard" "full")
for package in "${packages[@]}"; do
  if curl -f --max-time 30 "$DEPLOYMENT_URL/api/offline/packages/$package/manifest" > /dev/null 2>&1; then
    echo "✅ $package package manifest accessible"
  else
    echo "❌ $package package manifest failed"
    exit 1
  fi
done

echo "✅ All API endpoints accessible"

