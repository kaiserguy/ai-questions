#!/bin/bash

echo "Validating DOM elements..."

node -e "
const fs = require('fs');
const path = require('path');

const offlineViewPath = path.join('core', 'views', 'offline.ejs');
if (fs.existsSync(offlineViewPath)) {
  const content = fs.readFileSync(offlineViewPath, 'utf8');
  
  const requiredElements = [
    'id=\"chatSection\"',
    'id=\"wikiSection\"', 
    'id=\"progressSection\"',
    'id=\"downloadBtn\"',
    'id=\"progressText\"'
  ];
  
  for (const element of requiredElements) {
    if (!content.includes(element)) {
      console.error(\`❌ Missing required DOM element: \${element}\`);
      process.exit(1);
    }
  }
  
  // Check that chat and wiki sections exist (they should now be visible by default)
  // Previously these were hidden, but as of Issue #195 and #205, they should be visible
  // to provide immediate access to local AI chat and Wikipedia search features
  if (!content.includes('id=\"chatSection\"')) {
    console.error('❌ chatSection element not found');
    process.exit(1);
  }
  
  if (!content.includes('id=\"wikiSection\"')) {
    console.error('❌ wikiSection element not found');
    process.exit(1);
  }
  
  console.log('✅ DOM elements validation passed');
}
"

