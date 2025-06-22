echo "Checking for common JavaScript errors..."
        
# Check for undefined property access (my common error)
if grep -r "undefined\." --include="*.js" --include="*.cjs" --exclude-dir=node_modules --exclude-dir=tests .; then
  echo "❌ Found undefined property access - this would cause runtime errors"
  exit 1
fi

# Check for missing constructor parameters
if grep -r "new DownloadManager()" --include="*.js" --include="*.ejs" --exclude-dir=node_modules --exclude-dir=tests .; then
  echo "❌ Found DownloadManager instantiated without parameters"
  exit 1
fi

# Check for duplicate script declarations
if find . -name "*.ejs" -not -path "./node_modules/*" -exec grep -l "script.*download-manager" {} \; | xargs -I {} sh -c 'count=$(grep -c "script.*download-manager" "{}"); if [ "$count" -gt 1 ]; then echo "❌ Duplicate script declarations in {}"; exit 1; fi' | grep -q "❌"; then
  echo "❌ Found duplicate script declarations"
  exit 1
fi

echo "✅ No common errors detected"