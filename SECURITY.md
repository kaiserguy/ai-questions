# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| develop | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

### 1. Do Not Open a Public Issue

**Please do not report security vulnerabilities through public GitHub issues.**

### 2. Report Privately

Send a detailed report to the repository maintainer via:
- GitHub Security Advisories (preferred)
- Direct message to @kaiserguy on GitHub
- Email (if provided in profile)

### 3. Include in Your Report

- **Description:** Clear description of the vulnerability
- **Impact:** What an attacker could achieve
- **Steps to Reproduce:** Detailed steps to reproduce the issue
- **Affected Versions:** Which versions are affected
- **Suggested Fix:** If you have a fix in mind, please share it

### 4. What to Expect

- **Acknowledgment:** Within 48 hours
- **Initial Assessment:** Within 1 week
- **Fix Timeline:** Depends on severity
  - Critical: 24-48 hours
  - High: 1 week
  - Medium: 2 weeks
  - Low: 1 month
- **Public Disclosure:** After fix is deployed

## Security Best Practices

### For Contributors

1. **Never commit sensitive data:**
   - API keys
   - Passwords
   - Private keys
   - Tokens
   - Personal information

2. **Use environment variables:**
   - Store secrets in `.env` files (not committed)
   - Use GitHub Secrets for CI/CD
   - Never hardcode credentials

3. **Keep dependencies updated:**
   - Run `npm audit` regularly
   - Update vulnerable packages promptly
   - Review Dependabot alerts

4. **Follow secure coding practices:**
   - Validate all user input
   - Sanitize data before rendering
   - Use parameterized queries
   - Implement proper authentication/authorization

### For Users

1. **Keep your installation updated:**
   - Pull latest changes regularly
   - Review security advisories
   - Apply patches promptly

2. **Secure your environment:**
   - Use strong passwords
   - Enable 2FA on GitHub
   - Protect your API keys
   - Use HTTPS for all connections

3. **Report suspicious activity:**
   - Unusual behavior
   - Unexpected errors
   - Potential vulnerabilities

## Security Features

### Automated Security Scanning

We use the following tools to maintain security:

1. **npm audit:**
   - Runs on every commit
   - Checks for known vulnerabilities
   - Blocks deployment if critical issues found

2. **Dependabot:**
   - Automated dependency updates
   - Security patch PRs
   - Weekly vulnerability checks

3. **GitHub Security Advisories:**
   - Monitors dependencies
   - Alerts on new vulnerabilities
   - Provides remediation guidance

### CI/CD Security

Our deployment pipeline includes:

1. **Pre-deployment validation:**
   - Code quality checks
   - Security scans
   - Test suite execution

2. **Deployment verification:**
   - Health checks
   - Critical path validation
   - API endpoint testing

3. **Post-deployment monitoring:**
   - Error detection
   - Performance monitoring
   - Security event logging

## Known Security Considerations

### Authentication

- Uses Google OAuth for authentication
- Session management via express-session
- Secure cookie configuration required in production

### Data Storage

- User data stored in session
- No persistent database (stateless)
- Offline data stored in browser (IndexedDB)

### API Security

- Rate limiting recommended for production
- Input validation on all endpoints
- CORS configuration for hosted version

### Dependencies

Current security status:
- ✅ All known vulnerabilities patched (as of Jan 10, 2026)
- ✅ Regular Dependabot updates enabled
- ✅ Automated security scanning active

## Security Checklist for Deployment

Before deploying to production:

- [ ] All environment variables configured
- [ ] HTTPS enabled
- [ ] Secure session configuration
- [ ] Rate limiting enabled
- [ ] Error handling doesn't expose sensitive info
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Authentication working correctly
- [ ] No debug mode enabled
- [ ] No test/mock data in production

## Security Updates

We publish security updates through:

1. **GitHub Security Advisories**
2. **Release notes**
3. **CHANGELOG.md**
4. **Git tags**

Subscribe to repository notifications to stay informed.

## Responsible Disclosure

We believe in responsible disclosure and will:

1. **Acknowledge** your report promptly
2. **Investigate** the issue thoroughly
3. **Develop** a fix as quickly as possible
4. **Test** the fix comprehensively
5. **Deploy** the fix to all supported versions
6. **Disclose** the vulnerability publicly after fix is deployed
7. **Credit** you in the security advisory (if desired)

## Security Hall of Fame

We recognize and thank security researchers who help us improve:

*No vulnerabilities reported yet*

---

**Thank you for helping keep this project secure!**

For questions about this security policy, please open a discussion or contact the maintainers.

**Last Updated:** January 10, 2026
