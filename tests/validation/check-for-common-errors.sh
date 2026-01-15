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

# Check for duplicate script declarations (same file loaded twice)
for ejs_file in $(find . -name "*.ejs" -not -path "./node_modules/*"); do
  # Extract script src paths and check for duplicates
  duplicates=$(grep -o 'src="[^"]*"' "$ejs_file" | sort | uniq -d)
  if [ -n "$duplicates" ]; then
    echo "❌ Found duplicate script declarations in $ejs_file: $duplicates"
    exit 1
  fi
done

echo "✅ No common errors detected"