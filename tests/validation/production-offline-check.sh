#!/bin/bash

echo "🔍 Deep validation of offline functionality"

# Download the offline page and check for required elements
offline_content=$(curl -s --max-time 30 "$DEPLOYMENT_URL/offline/")

# Check for required DOM elements
required_elements=("chatSection" "wikiSection" "progressSection" "downloadBtn")
for element in "${required_elements[@]}"; do
  if echo "$offline_content" | grep -q "id=\"$element\""; then
    echo "✅ Found required element: $element"
  else
    echo "❌ Missing required element: $element"
    exit 1
  fi
done

# Check for required JavaScript files
required_scripts=("download-manager.js" "ai-models.js" "wikipedia.js" "integration-manager.js")
for script in "${required_scripts[@]}"; do
  if echo "$offline_content" | grep -q "$script"; then
    echo "✅ Found required script: $script"
  else
    echo "❌ Missing required script: $script"
    exit 1
  fi
done

# Check that sections are initially hidden
if echo "$offline_content" | grep -q 'id="chatSection"[^>]*style="[^"]*display:[[:space:]]*none'; then
  echo "✅ chatSection is initially hidden"
else
  echo "❌ chatSection should be initially hidden"
  exit 1
fi

if echo "$offline_content" | grep -q 'id="wikiSection"[^>]*style="[^"]*display:[[:space:]]*none'; then
  echo "✅ wikiSection is initially hidden"
else
  echo "❌ wikiSection should be initially hidden"
  exit 1
fi

echo "✅ Offline functionality validation passed"

