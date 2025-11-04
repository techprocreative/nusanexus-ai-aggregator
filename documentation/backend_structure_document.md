# Backend Structure Document

## 1. Backend Architecture

The backend is built on Next.js 14’s App Router and serverless API routes, with clear separation between presentation, business logic, and data layers. Key design patterns and frameworks include:

- Modular folder structure:  `app/api/` for routes, `utils/` for business logic, and `supabase/migrations/` for schema management.
- Service layer pattern: Business logic (e.g., credit checks) lives in `utils/creditManager.ts`, keeping API routes thin and focused on HTTP concerns.
- Webhook-driven updates: Payment events arrive via webhooks (Stripe or Tripay), triggering secure, asynchronous updates to user data.
- Proxy pattern: AI requests are proxied through our routes (`/api/chat`, `/api/media/generate`), hiding provider keys and centralizing error handling.
- TypeScript throughout: Ensures type safety for financial operations and external API interactions.

How this supports our goals:

- Scalability: Serverless functions on Vercel (or any provider) auto-scale under load. The stateless design means we won’t run out of capacity as user demand grows.
- Maintainability: Clear boundaries between modules make it easy for new developers to find and update code. Database migrations are version controlled.
- Performance: Edge caching for static assets, SSR/SSG for public pages, and React Query for client-side caching minimize latency.

## 2. Database Management

We use Supabase, which provides a managed PostgreSQL database, real-time capabilities, and built-in authentication support. Key points:

- Database type: Relational (PostgreSQL).
- Managed by Supabase: Automated backups, SSL encryption at rest, and dashboard for analytics.
- Access: Server-side uses an elevated‐privilege Supabase admin client (`utils/supabase/admin.ts`) to bypass Row Level Security (RLS) for trusted operations. Client‐side uses the public Supabase client with RLS policies.
- Data practices:
  - Row Level Security (RLS) to enforce per-user access.
  - Versioned migrations stored in `supabase/migrations/`.
  - Regular backups and health checks.
  - Audit logs for financial transactions.

## 3. Database Schema

Below is a human-friendly explanation, followed by the actual PostgreSQL schema.

### Tables and Their Purpose

• plans: Defines subscription tiers and their per-credit cost.
• user_credits: Tracks each user’s current credit balance.
• transactions: Logs every credit purchase or deduction, with references to the payment provider or AI job.
• models (optional): Stores AI model configs (provider, cost, status) for dynamic pricing.

```sql
-- plans table
CREATE TABLE plans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  credit_cost INTEGER NOT NULL,
  features JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_credits table
CREATE TABLE user_credits (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- transactions table
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL, -- e.g., 'purchase', 'deduction'
  amount INTEGER NOT NULL, -- credit amount added or removed
  provider TEXT,         -- e.g., 'tripay', 'openrouter'
  provider_ref TEXT,     -- external reference ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- models table (for dynamic model pricing)
CREATE TABLE models (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  cost_per_unit NUMERIC NOT NULL,
  markup_percent NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```  

## 4. API Design and Endpoints

The backend uses RESTful API routes within Next.js. All endpoints require a valid session via Clerk and enforce credit checks using our credit manager. Key endpoints:

- POST /api/payment/tripay
  • Purpose: Create a Tripay checkout session for credit purchase.
  • Input: { userId, planId }
  • Output: { checkoutUrl }

- POST /api/webhooks/tripay
  • Purpose: Receive Tripay events, verify signature, and update `user_credits` and `transactions`.

- GET /api/plans
  • Purpose: List available subscription plans and per-credit pricing.

- GET /api/credits
  • Purpose: Return the current user’s credit balance.

- GET /api/models
  • Purpose: Return active AI models with cost and provider info.

- POST /api/chat
  • Purpose: Handle chat requests.
  • Flow: 
    1) Check credit via `creditManager`.  
    2) Deduct credits.  
    3) Proxy request to OpenRouter or Together AI.  
    4) Stream response back to client.

- POST /api/media/generate
  • Purpose: Handle image/video generation requests with the same credit check and proxy pattern.

- GET /api/transactions
  • Purpose: Return a paginated list of the user’s past credit transactions.

## 5. Hosting Solutions

- Frontend & API: Deployed on Vercel (or any serverless provider such as AWS Lambda via Next.js).  
- Database: Supabase’s managed Postgres cluster.  
- CDN: Vercel’s global edge network or Cloudflare for static assets.  

Benefits:

- Reliability: Vercel and Supabase are SLA-backed, with automatic failover.
- Scalability: Serverless functions auto-scale to zero and up, perfectly matching traffic spikes.
- Cost-effectiveness: Pay-as-you-go pricing means you only pay for what you use, with generous free tiers during development.

## 6. Infrastructure Components

- Load Balancer / Edge Network: Vercel’s built-in edge routing ensures requests hit the nearest region.
- Caching:
  • CDN caching for static assets (JS/CSS/fonts).  
  • Edge function cache headers for semi-static API responses (plans, models).
  • Client-side caching with TanStack React Query for data revalidation.
- Rate Limiting: Implemented via Next.js middleware or a Redis-backed limiter (e.g., Upstash).
- Secrets Management: Environment variables in Vercel for API keys, database URLs, Clerk keys, and Tripay secrets.
- CI/CD: GitHub Actions for automated tests, linting, and deployments on each merge to `main`.

## 7. Security Measures

- Authentication & Authorization:
  • Clerk for user sign-in, sign-up, and session management.  
  • Middleware to protect API routes and enforce role-based access (e.g., only paid users can call certain endpoints).
- Data Encryption:
  • TLS/SSL for all in-transit data.  
  • Supabase encrypts data at rest by default.
- Webhook Verification:
  • Validate Tripay signatures before processing events.
- Row Level Security (RLS): In Supabase, ensure users can only read/write their own records.
- Input Validation & Sanitization: Use libraries like Zod to validate request payloads.
- Secrets Isolation: No secrets in code; everything stored in environment variables.
- Logging & Monitoring of security events via Sentry or a similar platform.

## 8. Monitoring and Maintenance

- Error Tracking: Sentry for capturing runtime exceptions in API routes and serverless functions.
- Performance Monitoring:
  • Vercel Analytics for response times and traffic patterns.  
  • Supabase dashboard for DB query performance and connection stats.
- Logs:
  • Next.js function logs in Vercel.  
  • Supabase audit logs for data changes.
- Alerts:
  • Sentry alerts for new or critical errors.  
  • Custom uptime checks (e.g., Pingdom) for key endpoints.
- Maintenance:
  • Database migrations with Supabase CLI and version control.  
  • Dependabot/GitHub Actions for dependency updates.  
  • Periodic review of RLS policies and security configs.

## 9. Conclusion and Overall Backend Summary

This backend is a modern, modular, and scalable solution for a credit-based AI aggregator. By leveraging Next.js serverless routes, Supabase’s managed Postgres, Clerk authentication, and a webhook-driven payment flow, we’ve built a system that:

- Centrally manages user subscriptions and credit balances.  
- Proxies AI requests securely to multiple providers (OpenRouter, Together AI).  
- Scales automatically with user demand and stays cost-efficient.  
- Enforces strong security and data integrity through RLS, validated webhooks, and encrypted channels.

Unique aspects:

- Credit-centric design that can accommodate any number of AI providers.  
- Modular service layer (`utils/`) for clean business logic and easy third-party integration.  
- Full end-to-end monitoring and maintenance strategy to keep the system reliable.

With this structure, anyone on the team—regardless of their background—can understand how the backend works and confidently build, extend, and maintain it over time.