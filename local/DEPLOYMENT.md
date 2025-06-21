# GitHub Actions Deployment Setup

## Overview
This repository now includes GitHub Actions for automatic deployment to Heroku on every push to the main branch.

## Required Secrets
You need to add the following secrets to your GitHub repository:

### How to Add Secrets:
1. Go to your GitHub repository
2. Click on **Settings** tab
3. Click on **Secrets and variables** → **Actions**
4. Click **New repository secret** for each of the following:

### Required Secrets:

#### 1. HEROKU_API_KEY
- **Name**: `HEROKU_API_KEY`
- **Value**: Your Heroku API key
- **How to get it**:
  1. Go to [Heroku Dashboard](https://dashboard.heroku.com/)
  2. Click on your profile picture → Account Settings
  3. Scroll down to "API Key" section
  4. Click "Reveal" and copy the key

#### 2. HEROKU_APP_NAME
- **Name**: `HEROKU_APP_NAME`
- **Value**: `peaceful-sierra-40313` (your app name)

#### 3. HEROKU_EMAIL
- **Name**: `HEROKU_EMAIL`
- **Value**: The email address associated with your Heroku account

## Workflow Features
- **Automatic deployment** on push to main branch
- **Node.js setup** with dependency caching
- **Test execution** (if tests are present)
- **Deployment verification** with app URL output
- **Pull request checks** (builds but doesn't deploy)

## How It Works
1. When you push code to the main branch
2. GitHub Actions automatically triggers
3. Installs dependencies and runs tests
4. Deploys to your Heroku app
5. Verifies deployment success

## Benefits
- ✅ **Reliable deployments** - no more manual deployment issues
- ✅ **Automatic process** - deploy on every push
- ✅ **Build verification** - catches issues before deployment
- ✅ **Deployment history** - track all deployments in GitHub
- ✅ **Rollback capability** - easy to revert if needed

## Next Steps
1. Add the required secrets to your GitHub repository
2. Push this workflow file to trigger the first automated deployment
3. Monitor the Actions tab to see deployment progress

## Troubleshooting
- Check the **Actions** tab in GitHub for deployment logs
- Verify all secrets are correctly set
- Ensure Heroku app name matches exactly
- Check Heroku dashboard for any app-specific issues

