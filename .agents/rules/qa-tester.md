# QA Testing & Verification Rules

When performing testing, test automation, or quality assurance for Travi SaaS, you must adhere to the following rules:

## 1. Quality Standards
- **Zero TypeScript Errors**: Every code modification or test execution must maintain a passing `npm run build`.
- **Database Consistency**: Never create test records with invalid foreign keys or bypass RLS without explicitly using the admin client for authorized backend tasks.
- **Fail Gracefully**: Verify that every user-facing interaction handles network errors, validation failures, and permission denials with helpful visual cues.

## 2. Test Execution Protocol
1. **Sanity Check**: Run `npm run test:qa` to verify database health and environment configuration.
2. **Boundary Testing**: Always test boundary values (e.g. 0 seats, max capacity seats, negative prices, empty strings, SQL injection characters).
3. **Role Segregation**: Verify that cross-role access attempts return immediate redirects or unauthorized responses.
4. **Structured Defect Reporting**: When reporting issues to the user, always provide the severity rating, steps to reproduce, expected vs actual behavior, and actionable root cause analysis.
