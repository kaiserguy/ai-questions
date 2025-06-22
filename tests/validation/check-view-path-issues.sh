#!/bin/bash

echo "Checking for view path configuration issues..."

# Check that hosted server has correct view configuration
if grep -q "path.join(__dirname, '../core/views')" hosted/index.cjs; then
  echo "✅ Hosted server has core views path configured"
else
  echo "❌ Hosted server missing core views path configuration"
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

