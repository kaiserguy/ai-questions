# Fix Offline Download Issues

## Phase 1: Analyze the download issues ✅
- [x] Pull latest changes from GitHub
- [x] Read and understand the console error logs
- [x] Identify the two main 404 errors:
  - AI model: `/offline/models/tinybert-uncased.bin` returns 404
  - Wikipedia database: `/offline/wikipedia/wikipedia-subset-20mb.db` returns 404
- [x] Note that fallback URLs are failing due to CORS or network errors

## Phase 2: Fix missing AI model resource ✅
- [x] Check if the AI model route exists in offline-resource-routes.js
- [x] Found that routes exist and work locally but fail on Heroku
- [x] Identified missing database and AI client initialization in hosted app
- [x] Fixed initialization of db, ai, and wikipedia variables
- [x] Fixed route mounting order and parameters

## Phase 3: Fix missing Wikipedia database resource ✅
- [x] Wikipedia database route already exists and is working
- [x] Same initialization fix applies to both AI model and Wikipedia routes
- [x] Both routes should now work on Heroku after the hosted app fixes

## Phase 4: Test the fixes and commit changes
- [ ] Test the offline download locally
- [ ] Verify both AI model and Wikipedia database download successfully
- [ ] Commit the fixes to GitHub
- [ ] Test on Heroku hosted version

