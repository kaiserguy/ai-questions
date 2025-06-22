#!/bin/bash

echo "Validating package configurations..."

node -e "
const fs = require('fs');
const path = require('path');

// Check if download-manager.js has proper package configurations
const downloadManagerPath = path.join('core', 'public', 'offline', 'download-manager.js');
if (fs.existsSync(downloadManagerPath)) {
  const content = fs.readFileSync(downloadManagerPath, 'utf8');
  
  const requiredPackages = ['minimal', 'standard', 'full'];
  const requiredProperties = ['name', 'aiModel', 'wikipedia'];
  
  for (const pkg of requiredPackages) {
    if (!content.includes(pkg + ':')) {
      console.error(\`❌ Missing package configuration: \${pkg}\`);
      process.exit(1);
    }
  }
  
  for (const prop of requiredProperties) {
    if (!content.includes(prop + ':')) {
      console.error(\`❌ Missing required property: \${prop}\`);
      process.exit(1);
    }
  }
  
  console.log('✅ Package configurations valid');
}
"

