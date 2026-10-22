# ShareLoop — Frontend Foundation

This directory contains the production-minded Single Page Application (SPA) for **ShareLoop**, a community item sharing, trading, and wanted-item request platform.

---

## 1. Prerequisites and Tooling

- **Node.js**: `v20.x` or higher (verified with `v24.12.0`)
- **Package Manager**: `npm` `v10.x` or higher (verified with `v11.6.2`)
- **Backend Service**: ShareLoop Spring Boot REST API (default `http://localhost:8080`)

---

## 2. Technology Stack

- **Core**: React 19, TypeScript (strict mode enabled), Vite 8
- **Routing**: React Router v7 (`react-router-dom`)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`) with curated emerald/teal design tokens
- **Server State**: TanStack Query v5 (`@tanstack/react-query`)
- **HTTP Client**: Axios with Bearer token interceptor and typed error normalizer
- **Form Infrastructure**: React Hook Form, Zod, and `@hookform/resolvers`
- **Icons**: Lucide React (`lucide-react`)
- **Testing**: Vitest, React Testing Library, `@testing-library/jest-dom`, JSDOM
- **Code Quality**: ESLint (v9/v10 flat configuration with TypeScript and React Hooks rules)

---

## 3. Project Structure and Architecture

```text
frontend/
├── .env.example              # Documented environment template
├── .env                      # Local environment overrides (git-ignored)
├── eslint.config.js          # ESLint flat configuration
├── index.html                # Application HTML entry point
├── package.json              # Dependencies and scripts
├── tsconfig.app.json         # Strict TypeScript application config
├── tsconfig.node.json        # TypeScript Node config
├── vite.config.ts            # Vite, Tailwind v4, Proxy, and Vitest configuration
└── src/
    ├── app/                  # Application bootstrap, routing, and providers
    │   ├── App.tsx           # Root component with Providers & RouterProvider
    │   ├── providers.tsx     # QueryClientProvider with cache defaults
    │   ├── router.tsx        # Public, Admin, and 404 route hierarchy
    │   └── __tests__/        # App shell and routing integration tests
    ├── components/
    │   ├── layout/           # Shared layout containers
    │   │   ├── Navbar.tsx    # Responsive header with mobile drawer & brand logo
    │   │   ├── Footer.tsx    # Responsive footer with metadata
    │   │   ├── MainLayout.tsx# Public user-facing layout wrapper
    │   │   └── AdminLayout.tsx# Dedicated administrative layout with sidebar
    │   └── ui/               # Reusable presentation primitives
    │       ├── Badge.tsx     # Status and category badges
    │       ├── Button.tsx    # Primary, secondary, outline, ghost, destructive buttons
    │       ├── Card.tsx      # Card, CardHeader, CardContent, CardFooter
    │       ├── Feedback.tsx  # LoadingSpinner, EmptyState, ErrorAlert, StatusBanner
    │       ├── Input.tsx     # Accessible form control with error message
    │       └── __tests__/    # UI component unit tests
    ├── features/             # Domain feature modules
    │   ├── about/            # About page
    │   ├── admin/            # Admin console overview, categories, reviews placeholders
    │   ├── explore/          # Marketplace explorer placeholder
    │   ├── health/           # Real live backend health check card
    │   ├── home/             # Landing page with hero & marketplace pillars
    │   └── not-found/        # 404 page with return-home navigation
    ├── lib/                  # Shared utilities and infrastructure
    │   ├── api-client.ts     # Centralized Axios client with Bearer auth interceptor
    │   ├── api-error.ts      # ApiError class and normalization helper
    │   ├── config.ts         # Runtime configuration validator
    │   ├── token-storage.ts  # Safe JWT token storage abstraction
    │   ├── utils.ts          # Class merger and date formatter helpers
    │   └── __tests__/        # Error normalizer and token storage unit tests
    ├── styles/
    │   └── index.css         # Tailwind v4 import, design tokens, and CSS variables
    ├── test/
    │   ├── setup.ts          # Vitest and jest-dom setup file
    │   └── test-utils.tsx    # Test render helper with QueryClientProvider
    └── types/                # Strongly-typed domain contracts
        ├── api.ts            # PageResponse, ApiErrorResponse, HealthResponse
        ├── auth.ts           # UserProfile, UserRole, UserStatus, AuthResponse
        ├── category.ts       # Category, CategoryDetail
        └── listing.ts        # ListingType, ListingStatus, ListingSummary
```

---

## 4. Environment Configuration

Copy the template file to configure local development:

```bash
cp .env.example .env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:8080` | URL of the Spring Boot REST API |
| `VITE_APP_ENV` | `development` | Active application environment |

> **Security Note:** Never store secrets or sensitive credentials in `VITE_*` environment variables. These values are compiled into browser-accessible code.

---

## 5. Development and Build Scripts

All commands should be executed from the `frontend/` directory:

```bash
# 1. Install dependencies
npm install

# 2. Start local development server with HMR (port 5173)
npm run dev

# 3. Execute TypeScript type checking (strict mode)
npm run typecheck

# 4. Run ESLint code inspection
npm run lint

# 5. Run test suite with Vitest
npm run test

# 6. Run test suite in interactive watch mode
npm run test:watch

# 7. Create optimized production build
npm run build

# 8. Preview production build locally
npm run preview
```

---

## 6. Backend Integration Contracts

The frontend architecture strictly mirrors the backend contracts verified in Phase 13A:

- **Base URL**: `http://localhost:8080`
- **Proxy**: Vite proxies `/api` requests to `http://localhost:8080` in local development to avoid browser CORS friction.
- **Authentication**: JWT Bearer token authentication via `Authorization: Bearer <token>`.
- **Error Format**: Normalizes Spring Boot `ErrorResponse` objects containing `timestamp`, `status`, `error`, `message`, `path`, and `errors` (field validation map).
- **Admin Scope**: Only genuine administrative endpoints (`POST/PUT/PATCH /api/v1/admin/categories` and `DELETE /api/v1/admin/reviews/{reviewId}`) are mapped into the Admin Console structure. Unsupported speculative administrative features are strictly avoided.

---

## 7. Phase 1 Boundaries

### Implemented in Phase 1 (Foundation):
- Complete React 19 + TypeScript + Vite 8 + Tailwind v4 infrastructure.
- Application routing with dual layouts: public marketplace (`MainLayout`) and administrative console (`AdminLayout`).
- Reusable UI primitives (`Button`, `Card`, `Badge`, `Input`, `LoadingSpinner`, `EmptyState`, `ErrorAlert`, `StatusBanner`).
- Centralized Axios client with Bearer auth token attachment and backend error normalization.
- Safe token storage abstraction.
- Live backend health status verification card using TanStack Query.
- Responsive design for mobile and desktop screens.
- Comprehensive test suite (27 tests across 6 files) covering components, routing, error handling, and token storage.

### Intentionally Deferred to Later Phases:
- **Phase 2**: Authentication & Authorization (Login/Register forms, JWT lifecycle, Route Guards).
- **Phase 3**: Listings & Marketplace Catalog (Browsing, search, filtering, item creation).
- **Phase 4**: Listing Requests & Offers workflow.
- **Phase 5**: Real-time / Polled Chat Messaging.
- **Phase 6**: Dual-confirmation Transaction Lifecycle.
- **Phase 7**: Ratings & Reviews feedback submission.
- **Phase 8**: Full Admin Dashboard CRUD operations.
