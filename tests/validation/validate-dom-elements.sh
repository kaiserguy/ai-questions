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
  
  // Check that chat and wiki sections are initially hidden
  if (!content.match(/id=\"chatSection\"[^>]*style=\"[^\"]*display:\\s*none/)) {
    console.error('❌ chatSection should be initially hidden');
    process.exit(1);
  }
  
  if (!content.match(/id=\"wikiSection\"[^>]*style=\"[^\"]*display:\\s*none/)) {
    console.error('❌ wikiSection should be initially hidden');
    process.exit(1);
  }
  
  console.log('✅ DOM elements validation passed');
}
"

