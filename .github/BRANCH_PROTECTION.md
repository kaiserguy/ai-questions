# Branch Protection Configuration

This document outlines the recommended branch protection rules for the `main` branch to ensure code quality and prevent accidental issues.

## Recommended Settings

### 1. Require Pull Request Reviews

**Setting:** Require a pull request before merging  
**Configuration:**
- ✅ Require approvals: **1 approval minimum**
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require review from Code Owners (if CODEOWNERS file exists)
- ⚠️ Allow specified actors to bypass required pull requests: **Repository admins only**

**Rationale:** Ensures all code changes are reviewed before merging, catching bugs and maintaining code quality.

---

### 2. Require Status Checks

**Setting:** Require status checks to pass before merging  
**Configuration:**
- ✅ Require branches to be up to date before merging
- ✅ Required status checks:
  - `validate` (from Deploy to Heroku workflow)
  - `deploy` (from Deploy to Heroku workflow)
  - `validate-production` (from Deploy to Heroku workflow)

**Rationale:** Prevents merging code that fails tests, validation, or deployment checks.

---

### 3. Require Conversation Resolution

**Setting:** Require conversation resolution before merging  
**Configuration:**
- ✅ All conversations must be resolved before merging

**Rationale:** Ensures all review comments and discussions are addressed before code is merged.

---

### 4. Require Signed Commits

**Setting:** Require signed commits  
**Configuration:**
- ⚠️ Optional but recommended for enhanced security

**Rationale:** Verifies commit authenticity and prevents impersonation.

---

### 5. Require Linear History

**Setting:** Require linear history  
**Configuration:**
- ⚠️ Optional - enforces squash or rebase merges only

**Rationale:** Keeps git history clean and easier to understand.

---

### 6. Block Force Pushes

**Setting:** Do not allow force pushes  
**Configuration:**
- ✅ Block force pushes to main branch

**Rationale:** Prevents accidental history rewriting that could cause issues for other developers.

---

### 7. Block Deletions

**Setting:** Do not allow deletions  
**Configuration:**
- ✅ Block deletion of main branch

**Rationale:** Prevents accidental deletion of the main branch.

---

### 8. Restrict Who Can Push

**Setting:** Restrict who can push to matching branches  
**Configuration:**
- ✅ Restrict pushes to main branch
- ✅ Allow: Repository admins, GitHub Actions (for automated deployments)
- ❌ Block: Direct pushes from developers

**Rationale:** Forces all changes through pull requests, ensuring review process is followed.

---

## How to Apply These Settings

### Via GitHub Web UI:

1. Navigate to: `https://github.com/kaiserguy/ai-questions/settings/branches`
2. Click "Add rule" or edit existing "main" branch rule
3. Apply the settings listed above
4. Click "Create" or "Save changes"

### Via GitHub CLI:

```bash
# Note: Branch protection rules are complex and best configured via web UI
# But you can view current rules with:
gh api repos/kaiserguy/ai-questions/branches/main/protection
```

### Via GitHub API:

```bash
curl -X PUT \
  -H "Authorization: token YOUR_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/kaiserguy/ai-questions/branches/main/protection \
  -d '{
    "required_status_checks": {
      "strict": true,
      "contexts": ["validate", "deploy", "validate-production"]
    },
    "enforce_admins": false,
    "required_pull_request_reviews": {
      "dismissal_restrictions": {},
      "dismiss_stale_reviews": true,
      "require_code_owner_reviews": false,
      "required_approving_review_count": 1
    },
    "restrictions": null,
    "required_linear_history": false,
    "allow_force_pushes": false,
    "allow_deletions": false,
    "required_conversation_resolution": true
  }'
```

---

## Current Status

**As of:** January 10, 2026

**Branch Protection:** ❌ Not configured  
**Status:** Awaiting manual configuration via GitHub web UI

---

## Benefits of Branch Protection

### Code Quality
- ✅ All code reviewed before merging
- ✅ Tests must pass before merging
- ✅ Validation scripts must succeed

### Security
- ✅ Prevents accidental force pushes
- ✅ Prevents branch deletion
- ✅ Requires approval for changes

### Collaboration
- ✅ Encourages discussion via pull requests
- ✅ Ensures all feedback is addressed
- ✅ Maintains clean git history

### Deployment Safety
- ✅ Only validated code reaches production
- ✅ Failed deployments block merging
- ✅ Automated checks prevent human error

---

## Exceptions and Overrides

### When to Override:

1. **Emergency Hotfixes:**
   - Critical security vulnerabilities
   - Production outages
   - Data loss prevention

2. **Automated Systems:**
   - Dependabot updates (minor/patch)
   - GitHub Actions deployments
   - Automated documentation updates

### How to Override:

**Repository admins can:**
- Bypass pull request requirements
- Merge without status checks
- Force push if absolutely necessary

**Best Practice:** Document all overrides with clear justification in commit messages or PR comments.

---

## Testing Branch Protection

After applying these settings:

1. **Test PR requirement:**
   ```bash
   # Try to push directly to main (should fail)
   git push origin main
   # Expected: Error - branch protection rules prevent direct push
   ```

2. **Test status checks:**
   - Create a PR with failing tests
   - Attempt to merge (should be blocked)
   - Fix tests and verify merge becomes available

3. **Test review requirement:**
   - Create a PR
   - Attempt to merge without approval (should be blocked)
   - Get approval and verify merge becomes available

---

## Maintenance

**Review branch protection rules:**
- ✅ Quarterly review of settings
- ✅ Update status check requirements as workflows change
- ✅ Adjust review requirements based on team size

**Monitor effectiveness:**
- Track number of blocked merges
- Review override usage
- Gather feedback from developers

---

## Related Documentation

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [.github/workflows/deploy.yml](workflows/deploy.yml) - CI/CD pipeline

---

## Questions or Issues?

If you encounter issues with branch protection settings:

1. Check GitHub Actions logs for status check failures
2. Review PR comments for review feedback
3. Contact repository admins for override requests
4. Open an issue for configuration questions

---

**Last Updated:** January 10, 2026  
**Maintained By:** Repository Administrators
