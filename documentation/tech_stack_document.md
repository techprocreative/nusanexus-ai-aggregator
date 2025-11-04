# Tech Stack Document

This document explains, in everyday language, the technology choices behind the `nusanexus-ai-aggregator` project. It shows how each piece fits together to create a secure, scalable, and user-friendly credit-based AI service aggregator.

## 1. Frontend Technologies

We use these tools to build what you see and interact with in your browser:

- **Next.js 14 (App Router)**
  - A framework built on React that makes it easy to create fast, SEO-friendly pages. It handles page routing, server-side rendering, and client-side interactivity in one package.
- **React & TypeScript**
  - React lets us build reusable bits of UI (like buttons or the chat window). TypeScript adds a safety net by checking our code for mistakes before we even run it.
- **Tailwind CSS**
  - A styling toolkit that uses small, reusable utility classes. It helps us create modern, consistent designs—like glass-like panels—without writing lots of custom CSS.
- **shadcn/ui**
  - A ready-made library of user interface components (modals, forms, buttons) that work well with Tailwind and follow accessibility best practices.
- **TanStack React Query**
  - Manages data fetching and state so the UI always shows up-to-date information (for example, displaying your current credit balance) without manual loading states.

These choices ensure a smooth, responsive, and visually appealing experience in your browser.

## 2. Backend Technologies

Behind the scenes, we use these technologies to handle business logic, data storage, and external service calls:

- **Next.js API Routes (Serverless Functions)**
  - Special endpoints you can call from the frontend (e.g., `/api/chat`). They run on demand, so you only pay for what you use and don’t have to manage servers yourself.
- **Supabase (PostgreSQL Database & Migrations)**
  - A hosted database that stores user accounts, credit balances, subscription plans, and transaction logs. Its migration system lets us version-control database changes, ensuring everyone works from the same setup.
- **Clerk (Authentication & User Management)**
  - Provides secure sign-up, sign-in, and session handling. It makes sure only authorized users can access protected features (like running AI jobs).
- **TypeScript (on the server)**
  - Catches errors in our backend code early, especially important when handling payments and credit calculations.

Together, these tools handle all data operations, enforce business rules around credits and subscriptions, and keep your sensitive information safe.

## 3. Infrastructure and Deployment

We rely on modern cloud services and workflows to ensure the application is always up, easy to update, and reliable:

- **Version Control: Git & GitHub**
  - Keeps track of all code changes and lets multiple developers collaborate without conflicts.
- **CI/CD: GitHub Actions**
  - Automatically runs tests and deploys updates whenever we push new code, ensuring fast and error-free releases.
- **Hosting Platform: Vercel**
  - Hosts both the frontend and serverless backend. It provides automatic scaling, global distribution, and preview URLs for every code change.
- **Database Hosting: Supabase**
  - Manages database uptime, backups, and scaling so we don’t have to run our own database servers.

These decisions give us continuous delivery, easy rollbacks, and a reliable environment for both code and data.

## 4. Third-Party Integrations

To extend functionality without building everything from scratch, we integrate:

- **Payment Processors**
  - **Stripe** (original starter integration) and **Tripay** (credit purchase gateway). Both support secure checkout sessions and webhooks to update user credits automatically.
- **AI Service Providers**
  - **OpenAI**, **OpenRouter**, and **Together AI**. Our backend proxies requests to whichever service you choose, so you can compare results or switch providers without reworking core logic.
- **Monitoring & Logging: Sentry**
  - Tracks errors and performance issues. If something goes wrong—like a failed payment or an AI request error—we get notified and can fix it quickly.

These integrations enhance payments, AI features, and error visibility—all without reinventing the wheel.

## 5. Security and Performance Considerations

We’ve built in safeguards and optimizations to protect data and keep things snappy:

- **Authentication & Authorization**
  - Clerk ensures only signed-in users can access AI endpoints. Route protection and role checks prevent unauthorized use.
- **Database Security: Row-Level Security & Admin Client**
  - Supabase RLS rules lock down who can read or write each table. A special admin client is used only by trusted backend code (e.g., Tripay webhooks) to update credit balances securely.
- **Data Protection**
  - All API calls happen over HTTPS. Secrets (API keys, database passwords) are stored in environment variables, not in the code.
- **Performance Optimizations**
  - Hybrid rendering in Next.js (static pages + server-side generation) keeps pages fast and SEO-friendly.
  - React Query caches data to minimize duplicate network requests.
  - Streaming responses for AI calls provide immediate feedback in the chat interface.

These measures ensure a smooth experience and keep your information safe.

## 6. Conclusion and Overall Tech Stack Summary

In summary, the `nusanexus-ai-aggregator` uses a modern, modular tech stack designed for building a credit-based AI platform:

- Frontend: Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui, React Query
- Backend: Next.js API Routes, Supabase (PostgreSQL + migrations), Clerk, TypeScript
- Infrastructure: GitHub & GitHub Actions, Vercel, Supabase hosting
- Integrations: Stripe/Tripay payments, OpenAI/OpenRouter/Together AI, Sentry logging
- Security & Performance: HTTPS, RLS, serverless functions, caching, streaming

Together, these choices give us a reliable, scalable base that handles authentication, data management, payment processing, and multi-provider AI aggregation—so developers can focus on delivering new features and you can enjoy a fast, secure service.