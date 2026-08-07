# JobForge Playwright E2E suite

The default suite is safe to run against a local app. Public routes, anonymous authorization boundaries, form validation, search/filter behavior, navigation, and payment/webhook rejection paths execute without credentials or mutations.

Role-specific and mutation tests are intentionally gated so a local run cannot create accounts, jobs, applications, interviews, uploads, notifications, emails, or payments accidentally.

## Commands

```powershell
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:report
```

## Optional staging variables

```text
PLAYWRIGHT_BASE_URL=https://staging.example.com
E2E_CANDIDATE_EMAIL=...
E2E_CANDIDATE_PASSWORD=...
E2E_RECRUITER_EMAIL=...
E2E_RECRUITER_PASSWORD=...
E2E_ADMIN_EMAIL=...
E2E_ADMIN_PASSWORD=...
E2E_ALLOW_MUTATIONS=true
E2E_RAZORPAY_ENABLED=true
E2E_BROWSERS=chromium,firefox,webkit
```

Use only isolated staging accounts and Razorpay test-mode credentials when enabling mutation or payment coverage.
