#!/bin/bash

echo "Checking for view path configuration issues..."

# Check that hosted server uses core app (which has correct views configuration)
if grep -q "createApp.*require.*core/app" hosted/hosted-app.js; then
  echo "✅ Hosted server uses core app with correct views configuration"
elif grep -q "path.join(__dirname, '../core/views')" hosted/hosted-app.js; then
  echo "✅ Hosted server has explicit core views path configured"
else
  echo "❌ Hosted server missing core views configuration"
  echo "Expected: createApp from core/app OR explicit core views path"
  exit 1
fi

# Check that there's no duplicate offline.ejs in hosted/views
if [ -f "hosted/views/offline.ejs" ]; then
  echo "❌ Found duplicate offline.ejs in hosted/views - should only be in core/views"
  exit 1
fi

# Check that core/views/offline.ejs exists
if [ ! -f "core/views/offline.ejs" ]; then
  echo "❌ Missing core/views/offline.ejs"
  exit 1
fi

echo "✅ View path configuration valid"

