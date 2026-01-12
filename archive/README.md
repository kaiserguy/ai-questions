# Archive Directory

This directory contains legacy code that has been replaced but is kept for reference during migration.

## Files

### `legacy-code/hosted-index.cjs.legacy`

**Status**: Archived January 12, 2026  
**Replaced By**: `hosted/hosted-app.js` + `core/routes.js`  
**Reason**: Monolithic file replaced by modular architecture  
**Remaining Features**: Analytics endpoints (Issue #32)  
**Delete After**: Issue #32 is complete  

**Do not use this file**. It is kept only for reference during analytics migration.

## Policy

Files in this directory:
- ❌ Should NOT be used in production
- ❌ Should NOT be imported by any code
- ❌ Should NOT be modified
- ✅ Can be referenced for migration purposes
- ✅ Should be deleted once migration is complete
