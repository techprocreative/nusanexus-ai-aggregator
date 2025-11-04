# nusanexus-ai-aggregator Project Requirements Document (PRD)

## 1. Project Overview

nusanexus-ai-aggregator is a modern SaaS starter template built with Next.js 14 that jump-starts the creation of a credit-based AI service aggregator. It solves the problem of integrating and managing multiple AI providers (like OpenRouter and Together AI) under one roof, complete with tiered subscription plans, credit purchase and tracking, user authentication, and secure payment processing. Developers can focus on business logic while this foundation handles common concerns like database schema, API routing, and UI components.

This project is being built to accelerate time-to-market for AI-driven applications that offer pay-as-you-go usage models. Key objectives of the first version include: 1) a working multi-tier subscription and credit purchase flow (using Tripay), 2) secure user authentication and session management, 3) serverless proxy endpoints for credit-checked AI calls, and 4) a reusable component library for chat, image, and video generation. Success is measured by delivering an end-to-end demo where users sign up, top up credits, and interact with at least two different AI backends seamlessly.

## 2. In-Scope vs. Out-of-Scope

**In-Scope (V1)**
- User authentication and profile management via Clerk
- Tiered subscription plans (free, professional, enterprise)
- Credit purchase flow using Tripay checkout sessions and webhooks
- Database schema for `user_credits`, `transactions`, and `plans` (Supabase migrations)
- Serverless API routes for:
  - Creating and verifying Tripay payment sessions
  - Checking and deducting credits
  - Proxying requests to OpenRouter and Together AI
- Reusable React components:
  - ChatInterface
  - CompareResults
  - ImageGenForm and VideoGenForm
- Centralized credit management logic (`creditManager.ts`)
- Basic error handling, logging hooks for payments and AI calls
- Unit and integration test skeletons for core business logic

**Out-of-Scope (Future Phases)**
- Fully dynamic model configuration via database UI
- Automatic credit refunds for failed AI requests
- Advanced rate-limiting or caching layers for AI calls
- In-depth theming system beyond basic glass-morphism styles
- Multi-language or localization support
- Mobile-first native apps or React Native versions

## 3. User Flow

A new user lands on the homepage and clicks Sign Up. They complete the Clerk-powered registration form and are redirected to their dashboard. On the dashboard, they see their current subscription tier and credit balance. A sidebar provides navigation to "Buy Credits," "Chat AI," "Generate Image/Video," and "Compare Models." If they are on a free tier, stripe-like callouts prompt them to upgrade or purchase credits.

When the user clicks "Buy Credits," they select a plan and number of credits, then begin a Tripay checkout. After completing payment, Tripay sends a webhook to update the user’s credits in Supabase. The dashboard refreshes to show the new balance. From there, the user navigates to Chat or Media Generation, enters their prompt, and submits. The app’s API route checks credits, deducts the cost, proxies the request to the chosen AI provider, and streams the response back into the UI.

## 4. Core Features

- **Authentication & Authorization**: Clerk integration for sign up, sign in, session management, and route protection.
- **Subscription Management**: Predefined plans (free, pro, enterprise) with feature gating based on tier.
- **Credit System**: Purchase, balance tracking, and usage deduction using a centralized credit manager.
- **Payment Integration**: Tripay checkout session creation and webhook handling to update `transactions` and `user_credits` tables.
- **AI Proxy Endpoints**: Serverless routes that enforce credit checks and route requests to OpenRouter or Together AI.
- **Reusable UI Components**: ChatInterface, CompareResults, ImageGenForm, VideoGenForm built with shadcn/ui and styled by Tailwind CSS.
- **Database Migrations**: Supabase migration files for version-controlled schema updates.
- **Business Logic Modules**: `utils/creditManager.ts`, `utils/tripay/`, `utils/openrouter/`, `utils/togetherai/`, and secure `utils/supabase/admin.ts` for privileged operations.
- **Testing Framework**: Unit tests for credit logic, integration tests for webhook processing, E2E test outlines for the user journey.

## 5. Tech Stack & Tools

- Frontend: Next.js 14 (App Router), React, TypeScript
- Styling & UI: Tailwind CSS, shadcn/ui
- Authentication: Clerk
- Database: Supabase (PostgreSQL + migrations)
- State Management & Data Fetching: TanStack React Query
- Serverless Functions: Next.js API Routes
- Payment Gateway: Tripay (via custom API routes and webhooks)
- AI Providers: OpenRouter, Together AI (proxied through internal endpoints)
- Testing: Jest for unit tests, Playwright or Cypress for E2E tests
- Logging & Monitoring: Sentry (or similar) for error tracking

## 6. Non-Functional Requirements

- **Performance**: API routes respond within 200ms under normal load; streaming AI responses should start within 1 second.
- **Scalability**: Serverless endpoints and Supabase can handle 1,000 concurrent users without schema changes.
- **Security**: All AI and payment API keys stored in environment variables; RLS enforced on Supabase tables except for admin client operations; HTTPS enforced.
- **Usability**: UI components must be accessible (WCAG AA), mobile-responsive, and consistent across pages.
- **Compliance**: GDPR-ready consent flow if collecting personal info; PCI-compliant payment handling via Tripay.

## 7. Constraints & Assumptions

- Tripay’s API and webhooks are reliable and available in target region.
- Supabase supports Row-Level Security and custom migrations as required.
- AI providers (OpenRouter, Together AI) offer compatible streaming APIs.
- Clerk authentication works seamlessly with Next.js App Router middleware.
- Users will have modern browsers supporting ES6 and fetch streams.

## 8. Known Issues & Potential Pitfalls

- **API Rate Limits**: OpenRouter or Together AI may throttle—plan to implement exponential backoff or caching for repeat prompts.
- **Webhook Reliability**: Ensure idempotent processing of Tripay events (use unique transaction IDs) to avoid duplicate credit top-ups.
- **Credit Consistency**: Race conditions if multiple AI requests fire simultaneously—use database transactions or row-level locks in `creditManager`.
- **Error Handling**: Network or provider errors should trigger clear messages and optionally refund credits; centralize this logic.
- **Migration Conflicts**: Collaborators running different migration versions—enforce a CI check or migration lock file.

---
This PRD provides a clear reference for building the nusanexus-ai-aggregator. Subsequent technical documents (Tech Stack, Frontend Guidelines, Backend Structure, App Flow, File Structure) should directly map to these requirements and leave no ambiguity for the AI model or implementation team.