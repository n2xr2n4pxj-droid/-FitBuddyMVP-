# FitBuddy - Personal Fitness Tracking Application

## Overview

FitBuddy is a full-stack fitness tracking web application that enables users to log meals and workouts, visualize their progress through interactive charts, and monitor their nutrition intake. The application integrates with the USDA FoodData Central API for automatic nutrition lookup and provides daily/weekly summaries with trend analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React with TypeScript for type safety and component-based UI
- Vite as the build tool for fast development and optimized production builds
- Wouter for lightweight client-side routing

**UI Components & Styling**
- shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Material Design + Linear-inspired productivity patterns for data-first interfaces
- Custom typography using Inter (primary) and JetBrains Mono (metrics)
- Responsive grid layouts (mobile-first: 1 column, tablet: 2 columns, desktop: 3-4 columns)

**State Management**
- TanStack React Query for server state management, caching, and synchronization
- Custom hooks pattern for authentication state (`useAuth`)
- Form state handled by React Hook Form with Zod schema validation

**Data Visualization**
- Chart.js for rendering line charts showing 7-day calorie and workout trends
- Custom chart components with responsive design

### Backend Architecture

**Server Framework**
- Express.js for RESTful API endpoints
- Session-based authentication using express-session
- PostgreSQL session store for persistent sessions

**API Design**
- RESTful endpoints organized by resource (`/api/meals`, `/api/workouts`, `/api/summary`)
- Protected routes requiring authentication via middleware
- Date-based filtering for time-series data (daily and weekly summaries)

**Request Flow**
1. Client makes authenticated request
2. Session middleware validates user session
3. Route handler validates request data using Zod schemas
4. Storage layer performs database operations
5. Response returned with appropriate status codes

### Data Storage

**Database System**
- PostgreSQL (Neon serverless) as the primary relational database
- Drizzle ORM for type-safe database queries and schema management
- WebSocket-based connection pooling via @neondatabase/serverless

**Schema Design**
- `users` table: User profiles linked to authentication provider
- `meals` table: Food intake records with nutrition data (calories, protein, carbs, fat)
- `workouts` table: Exercise sessions with type, duration, and notes
- `sessions` table: Session storage for authentication persistence
- Foreign key relationships with cascade deletion for data integrity

**Data Access Pattern**
- Repository pattern implemented via `DatabaseStorage` class
- Type-safe interfaces (`IStorage`) defining all data operations
- Aggregation queries for daily and weekly summaries using SQL

### Authentication & Authorization

**Authentication Provider**
- Replit Auth (OpenID Connect) supporting multiple login methods:
  - Google OAuth
  - GitHub OAuth
  - Email/password
- Passport.js strategy for OpenID Connect integration

**Session Management**
- Server-side sessions stored in PostgreSQL
- 7-day session TTL with automatic renewal
- HTTP-only cookies for security
- `saveUninitialized: true` to ensure session creation during OAuth flow
- `sameSite: 'lax'` to allow cookies on redirects from auth provider
- `secure: false` in development for local testing
- CSRF protection via session secret

**Authorization Pattern**
- `isAuthenticated` middleware protects API routes
- User ID extracted from session claims (`req.user.claims.sub`)
- Row-level security: all queries filtered by authenticated user ID

## External Dependencies

**Third-Party Services**
- **USDA FoodData Central API**: Nutrition data lookup for automatic meal logging
- **Replit Auth**: Authentication service (OpenID Connect provider)
- **Neon**: Serverless PostgreSQL database hosting

**Key npm Packages**
- **Authentication**: `passport`, `openid-client`, `express-session`, `connect-pg-simple`
- **Database**: `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit`
- **Frontend**: `react`, `@tanstack/react-query`, `wouter`, `react-hook-form`, `zod`
- **UI Components**: `@radix-ui/*` (20+ component primitives), `tailwindcss`, `chart.js`
- **Utilities**: `date-fns`, `nanoid`, `memoizee`

**Development Tools**
- TypeScript for type checking across client and server
- Vite plugins for Replit integration (runtime errors, cartographer, dev banner)
- ESBuild for server bundling in production