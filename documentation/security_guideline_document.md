# Security Guidelines for nusanexus-ai-aggregator

This document outlines security best practices and controls tailored for the `nusanexus-ai-aggregator` repository. Adhering to these guidelines will help ensure a secure, resilient, and maintainable codebase throughout its lifecycle.

## 1. Secure Architecture & Design Principles
- **Security by Design**: Embed security considerations into every layer (frontend, backend, database, and infrastructure) from the start.
- **Least Privilege**: Grant services, database roles, and third-party clients only the minimum permissions required (e.g., RLS policies in Supabase should restrict each user to their own `user_credits` and `transactions`).
- **Defense in Depth**: Layer multiple controls—authentication, input validation, network segmentation, monitoring, and rate limiting—to mitigate single points of failure.
- **Secure Defaults**: Ship with secure configuration out-of-the-box (e.g., enforce HTTPS, default deny CORS, disabled verbose logging).
- **Fail Securely**: On errors or exceptions, return generic error messages without leaking stack traces or sensitive data. Always roll back partial state changes.

## 2. Authentication & Access Control
- **Clerk Integration**: 
  - Enforce MFA for high-privilege or enterprise accounts.
  - Verify and validate session tokens (JWT) on every API route via Clerk’s middleware.
- **Role-Based Access Control (RBAC)**:  
  - Define roles (e.g., `free`, `pro`, `enterprise`, `admin`) and map feature gates server-side.
  - Use Supabase RLS to ensure users only read/write their own data.
- **Session Management**:  
  - Use `HttpOnly`, `Secure`, and `SameSite=Strict` cookies.
  - Enforce short token lifetimes and implement idle/absolute timeouts.
- **Credential Storage**:  
  - Hash any stored passwords (if used) with Argon2 or bcrypt and unique salts.

## 3. Input Handling & Validation
- **Server-Side Validation**: Never trust client input. For each API endpoint:
  - Validate JSON schemas with a library like Zod or Joi.
  - Reject unexpected properties and enforce length/type constraints.
- **Prevent Injection**:
  - Use Supabase’s parameterized queries or official SDK to avoid SQL injection.
  - Sanitize any file upload filenames to prevent path traversal.
- **XSS Mitigation**:
  - Escape or encode all user-supplied values in React components.
  - Use a restrictive Content Security Policy (CSP) header.
- **Validate Redirects**:
  - Only allow redirect URLs from an explicit allow-list (e.g., your own domain).

## 4. Data Protection & Secrets Management
- **Encryption in Transit**:
  - Enforce TLS 1.2+ for all API and database connections.
  - Enable HSTS (`Strict-Transport-Security`) on frontend responses.
- **Encryption at Rest**:
  - Ensure Supabase/Postgres disk encryption is enabled.
  - Store backups in encrypted form.
- **Secrets Management**:
  - Do _not_ hardcode API keys or credentials in source code. Use environment variables injected via a secret store (e.g., HashiCorp Vault, AWS Secrets Manager).
  - Rotate keys periodically and on compromise.
- **PII Protection**:
  - Mask or redact personally identifiable information in logs and error messages.

## 5. API & Service Security
- **HTTPS Enforcement**: All `/api/*` routes must reject HTTP and redirect to HTTPS.
- **Rate Limiting & Throttling**:
  - Implement per-user and per-IP rate limits (e.g., 100 requests/minute) to protect AI proxy endpoints and payment routes.
- **CORS**:
  - Restrict `Access-Control-Allow-Origin` to your trusted frontends.
  - Use `Access-Control-Allow-Credentials` only if necessary with `SameSite` cookies.
- **API Versioning**: Prefix endpoints (`/api/v1/chat`, `/api/v1/payment`) to manage breaking changes.
- **Payment Webhooks**:
  - Validate webhook signatures/secret tokens from Tripay or Stripe.
  - Idempotently process events to avoid duplicate credit changes.

## 6. Web Application Security Hygiene
- **Security Headers**:
  - Content-Security-Policy: restrict scripts, fonts, and styles to whitelisted sources.
  - X-Frame-Options: `DENY` or `SAMEORIGIN` to prevent clickjacking.
  - X-Content-Type-Options: `nosniff` to avoid MIME-type confusion.
  - Referrer-Policy: `no-referrer-when-downgrade` or stricter.
- **CSRF Protection**:
  - Use anti-CSRF tokens (Synchronizer Token Pattern) for all state-changing endpoints.
- **Secure Client Storage**:
  - Avoid storing tokens or PII in `localStorage` or `sessionStorage`. Prefer `HttpOnly` cookies.
- **Subresource Integrity (SRI)**:
  - Apply SRI hashes to any CDN-loaded scripts/styles.

## 7. Infrastructure & Deployment Security
- **Server Hardening**:
  - Disable all unnecessary services and ports on hosting servers.
  - Apply OS and package updates automatically (or in regular maintenance windows).
- **TLS Configuration**:
  - Use strong cipher suites and disable SSLv3/TLS 1.0/1.1.
  - Renew certificates automatically.
- **Least Privilege in CI/CD**:
  - CI runners and deployment pipelines should have scoped tokens with minimal permissions.
  - Protect pipeline secrets and audit access logs.
- **Environment Segregation**:
  - Separate development, staging, and production resources. Limit data exposure across environments.

## 8. Dependency Management
- **Secure Dependencies**:
  - Vet all npm packages (Tailwind, shadcn/ui, React Query, etc.) and pin to specific, tested versions in `package-lock.json`.
  - Run automated SCA (Software Composition Analysis) scans in CI.
- **Regular Updates**:
  - Subscribe to security bulletins for Next.js, Clerk, Supabase, and core libraries.
  - Test and deploy minor/patch upgrades promptly.
- **Minimize Footprint**:
  - Only include necessary dependencies. Remove unused packages to reduce attack surface.

## 9. Monitoring, Logging & Incident Response
- **Centralized Logging**:
  - Capture and aggregate logs (application errors, authentication events, payment flows) in a secure log store (e.g., Sentry, Datadog).
  - Avoid logging sensitive data (PII, API keys, raw credit balances).
- **Alerting & Dashboards**:
  - Configure alerts for anomalous events (spikes in 500 errors, rate-limit breaches, webhook failures).
- **Incident Response Plan**:
  - Document steps for handling data breaches, payment disputes, or service outages.
  - Perform regular tabletop exercises and post-mortems.

---
By following these security guidelines, the `nusanexus-ai-aggregator` project will be well-positioned to deliver a robust, compliant, and trustworthy AI aggregation platform. Ensure ongoing review and iteration of these practices as the codebase evolves and new threats emerge.