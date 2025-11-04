# Frontend Guidelines for nusanexus-ai-aggregator

## 1. Frontend Architecture

The nusanexus-ai-aggregator frontend is built on **Next.js 14** with the **App Router**, leveraging a hybrid rendering approach for both server-side and client-side content. Here are the core pieces:

- **Next.js 14 (App Router)**: Provides file-based routing, server components, and serverless API routes. It balances performance (via server rendering) with interactivity (via client components).
- **TypeScript**: Ensures type safety throughout the codebase, reducing runtime errors—especially important when handling financial data and API responses.
- **Clerk**: Manages authentication and user sessions seamlessly, protecting routes and gating features based on user identity.
- **Supabase**: Hosts a PostgreSQL database and handles migrations. The elevated-privilege admin client is used server-side for secure credit and transaction updates.
- **TanStack React Query**: Manages server state (e.g., fetching credit balances, subscription status) with built-in caching and background updates.
- **Tailwind CSS** and **shadcn/ui**: Provide utility-first styling and pre-built, accessible UI components you can customize.
- **Next.js API Routes**: Encapsulate backend logic for AI proxy endpoints (`/api/chat`, `/api/media/generate`) and payment/webhook handlers (`/api/payment/tripay`, `/api/webhooks/tripay`).

This architecture supports:
- **Scalability**: Modular design lets you add or replace AI providers and payment gateways without rewriting core logic.
- **Maintainability**: Clear directory structure (`app/`, `components/`, `hooks/`, `utils/`, `supabase/migrations/`) separates concerns.
- **Performance**: Hybrid rendering and built-in optimizations (image handling, code splitting) deliver fast page loads.

## 2. Design Principles

### Usability
- Clean layouts with clear calls to action (e.g., Buy Credits, Submit Prompt).
- Intuitive flows: credit purchase, AI request, and results review are straightforward.

### Accessibility
- shadcn/ui components follow WAI-ARIA standards.
- Use semantic HTML (e.g., `<button>`, `<form>`, `<nav>`).
- Ensure color contrast meets WCAG AA.

### Responsiveness
- Mobile-first design ensures functionality on phones, tablets, and desktops.
- Tailwind’s responsive utilities (`sm:`, `md:`, `lg:`) adapt layouts fluidly.

### Consistency
- Shared tokens for spacing, typography, and colors.
- Reusable components enforce uniform look and behavior.

## 3. Styling and Theming

### Approach
- **Utility-First CSS**: Tailwind CSS keeps styles co-located with markup, speeding development.
- **Component CSS**: When needed, scoped styles can be added via CSS Modules or styled JSX.

### CSS Methodology
- Follow a **BEM-inspired** convention for custom classes (e.g., `card__header`, `form__submit`) when utility classes are insufficient.

### Theming
- **Glassmorphism** style: Semi-transparent panels with backdrop blur.
- A light/dark toggle can be implemented with Tailwind’s dark mode.

### Color Palette
- Primary: #4F46E5 (indigo-600)
- Secondary: #10B981 (emerald-500)
- Accent: #F59E0B (amber-500)
- Background: #F3F4F6 (gray-100) / Dark background: #1F2937 (gray-800)
- Surface: rgba(255, 255, 255, 0.75) with backdrop-filter: blur(10px)
- Text: #111827 (gray-900) / Dark text: #E5E7EB (gray-200)

### Typography
- Font Family: **Inter** (sans-serif)
- Headings: 600 weight for emphasis
- Body: 400 weight for readability

## 4. Component Structure

All React components are organized by feature domain:

- **components/**: Reusable UI pieces (e.g., `ChatInterface.tsx`, `ImageGenForm.tsx`, `CompareResults.tsx`).
- **app/components/**: Page-specific or layout components under the App Router.
- **hooks/**: Custom hooks (`useSubscription.ts`, `useCredits.ts`) encapsulate client-side logic.
- **utils/**: Business logic and integrations (`creditManager.ts`, `tripay/`, `openrouter/`, `togetherai/`).

Benefits of this structure:
- **Encapsulation**: Each component/self-contained module has a single responsibility.
- **Reusability**: Shared components reduce duplication and bugs.
- **Clarity**: New developers can quickly find and extend functionality.

## 5. State Management

### Server State
- **TanStack React Query** handles data fetching, caching, and background updates for:
  - User credit balance
  - Subscription status
  - AI request responses

### Client State
- **React Context** (if needed) for UI themes or ephemeral form state.
- Local component state (`useState`) for simple toggles and form inputs.

All credit- or subscription-related logic is centralized in `utils/creditManager.ts`, ensuring consistent behavior across the app.

## 6. Routing and Navigation

### Routing
- File-based under `app/`, using Next.js App Router.
- **Layouts**: Shared `layout.tsx` defines navigation bars, footers, and authentication checks.
- **Dynamic routes**: e.g., `app/chat/[modelId]/page.tsx` for model-specific chat.

### Navigation
- **Next.js `Link`** component for client-side transitions.
- Active link styling highlights the user’s current section.
- Protected routes redirect unauthenticated users to the sign-in page (configured in middleware).

## 7. Performance Optimization

- **Code Splitting**: Next.js automatically splits code per page, loading only what’s needed.
- **Dynamic Imports**: Lazy-load heavy components (e.g., media forms) with `next/dynamic`.
- **Image Optimization**: Use Next.js `<Image>` for responsive, optimized images.
- **Caching**: React Query caches API responses and re-uses data, reducing network calls.
- **Minification & Compression**: Next.js handles JS/CSS minification and Brotli/Gzip compression.

## 8. Testing and Quality Assurance

### Unit Testing
- **Jest** + **React Testing Library** for component and utility tests.
- Cover `creditManager.ts` logic, form validation, and helper functions.

### Integration Testing
- Test Next.js API Routes (`/api/payment/tripay`, `/api/webhooks/tripay`) using **Supertest** or built-in Node testing utilities.
- Validate database updates via Supabase test client.

### End-to-End Testing
- **Playwright** or **Cypress** to simulate user flows:
  1. Sign in / sign up flow
  2. Buying credits
  3. Making an AI request and verifying credit deduction

### Linting and Formatting
- **ESLint** with TypeScript plugin enforces code style and catches errors early.
- **Prettier** for consistent formatting.

### Monitoring
- **Sentry** for real-time error tracking and performance monitoring.

## 9. Conclusion and Overall Frontend Summary

This document outlines a clear, modular, and scalable frontend setup:

- Built on Next.js 14, TypeScript, and Clerk for rock-solid authentication.
- Utility-first styling with Tailwind CSS and glassmorphism theming.
- Component-based architecture for maintainability.
- React Query for smooth data fetching and caching.
- Modern testing strategy covering units to end-to-end flows.

By following these guidelines, any developer—technical or not—can understand and extend the frontend of nusanexus-ai-aggregator, ensuring a consistent user experience and reliable operation as the application grows.