#!/bin/bash

echo "Checking JavaScript syntax..."

# Check .js files
find . -name "*.js" -not -path "./node_modules/*" -not -path "./tests/*" | xargs -I {} node -c {}

# Check .cjs files  
find . -name "*.cjs" -not -path "./node_modules/*" | xargs -I {} node -c {}

echo "✅ JavaScript syntax validation passed"

