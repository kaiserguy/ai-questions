#!/bin/bash

# Validate required environment variables
if [ -z "$DEPLOYMENT_URL" ]; then
    echo "❌ ERROR: DEPLOYMENT_URL environment variable not set"
    echo "This script requires DEPLOYMENT_URL to be set to the production URL"
    exit 1
fi

echo "🐛 Checking for JavaScript errors"

# Install puppeteer for browser testing
npm install puppeteer

# Create a simple script to check for JS errors
cat > check-js-errors.js << 'EOF'
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
  });
  
  try {
    await page.goto(process.env.DEPLOYMENT_URL + '/offline/', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait a bit for any delayed JavaScript execution
    await page.waitForTimeout(5000);
    
    if (errors.length > 0) {
      console.log('❌ JavaScript errors detected:');
      errors.forEach(error => console.log(`  - ${error}`));
      process.exit(1);
    } else {
      console.log('✅ No JavaScript errors detected');
    }
  } catch (error) {
    console.log(`❌ Failed to load page: ${error.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
EOF

# Run the error check
node check-js-errors.js

# Clean up
rm check-js-errors.js

echo "✅ JavaScript error check completed"

