# FitBuddy - Your Personal Fitness Tracking Companion

FitBuddy is a full-stack web application that helps users track their daily meals and workouts, visualize their progress with beautiful charts, and stay on top of their fitness journey with smart nutrition insights powered by Open Food Facts.

## Features

### 🍽️ Meal Tracking
- Log meals with detailed nutrition information (calories, protein, carbs, fat)
- Search Open Food Facts database for automatic nutrition lookup
- Categorize meals by type (breakfast, lunch, dinner, snack)
- View today's meal log with complete nutrition breakdown

### 💪 Workout Logging
- Track various workout types (running, strength training, yoga, etc.)
- Record duration and add optional notes
- Monitor total workout minutes per day
- View workout history at a glance

### 📊 Progress Visualization
- Daily summary cards showing:
  - Total calories consumed
  - Total protein intake
  - Number of meals logged
  - Total workout minutes
- 7-day trend charts for:
  - Calorie intake over time
  - Workout minutes over time
- Beautiful, responsive design that works on all devices

### 🔐 Secure Authentication
- Powered by Replit Auth
- Support for multiple login methods (Google, GitHub, email/password)
- Protected routes and secure session management

## Tech Stack

### Frontend
- **React** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **Chart.js** for data visualization
- **React Query** for server state management
- **Wouter** for routing

### Backend
- **Node.js** with Express
- **PostgreSQL** (Neon) for database
- **Drizzle ORM** for type-safe database queries
- **Passport.js** with OpenID Connect for authentication
- **Zod** for request validation

### External APIs
- **Open Food Facts API** for nutrition data

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   │   ├── ui/       # shadcn/ui base components
│   │   │   ├── meal-form.tsx
│   │   │   ├── workout-form.tsx
│   │   │   ├── meal-list.tsx
│   │   │   ├── workout-list.tsx
│   │   │   └── weekly-chart.tsx
│   │   ├── pages/        # Page components
│   │   │   ├── landing.tsx
│   │   │   ├── dashboard.tsx
│   │   │   └── not-found.tsx
│   │   ├── hooks/        # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   └── use-toast.ts
│   │   ├── lib/          # Utility functions
│   │   │   ├── queryClient.ts
│   │   │   ├── authUtils.ts
│   │   │   └── utils.ts
│   │   ├── App.tsx       # Main app component with routing
│   │   ├── index.css     # Global styles
│   │   └── main.tsx      # App entry point
│   └── index.html
│
├── server/                # Backend Express server
│   ├── db.ts             # Database connection
│   ├── storage.ts        # Data access layer
│   ├── routes.ts         # API route definitions
│   ├── replitAuth.ts     # Authentication setup
│   ├── index.ts          # Server entry point
│   └── vite.ts           # Vite dev server integration
│
├── shared/               # Shared code between frontend and backend
│   └── schema.ts         # Database schema and TypeScript types
│
└── design_guidelines.md  # Design system documentation
```

## Getting Started

### Prerequisites
- Node.js 20+ installed
- PostgreSQL database (automatically provisioned on Replit)

### Environment Variables
Create a `.env` file or use Replit Secrets with the following variables:

```bash
DATABASE_URL=<your-postgres-connection-string>
SESSION_SECRET=<random-secret-for-sessions>
REPL_ID=<your-repl-id>
```

### Installation

1. Install dependencies:
```bash
npm install
```

2. Push database schema:
```bash
npm run db:push
```

3. Start the development server:
```bash
npm run dev
```

The app will be available at http://localhost:5000 (or your Replit URL).

## How It Works

### Authentication Flow
1. User clicks "Get Started" or "Log In" on the landing page
2. Redirected to `/api/login` which initiates Replit Auth flow
3. After successful authentication, redirected back to dashboard
4. All API requests include session cookie for authentication
5. Protected routes use `isAuthenticated` middleware

### Meal Logging Flow
1. User opens "Add Meal" form on dashboard
2. Can search food database by clicking search icon
3. Select food from results to auto-fill nutrition data
4. Or manually enter food name and nutrition values
5. Submit form → API validates with Zod → Saves to database
6. React Query automatically invalidates and refetches:
   - Meal list for today
   - Daily summary metrics
   - Weekly trend chart data

### Workout Logging Flow
1. User opens "Add Workout" form on dashboard
2. Select workout type from dropdown
3. Enter duration in minutes
4. Optionally add notes
5. Submit form → API validates → Saves to database
6. React Query updates all related data automatically

### Dashboard Summary Calculation
- **Daily Summary**: Aggregates all meals and workouts for selected date
  - Sums calories, protein, carbs, fat from meals
  - Sums duration minutes from workouts
  - Counts total meals and workouts
- **Weekly Summary**: Generates 7 daily summaries (today - 6 days)
  - Chart.js visualizes trends over time
  - Dual-axis chart: calories on left, minutes on right

### Food Search API Integration
- Backend proxies requests to Open Food Facts
- Endpoint: `/api/food/search?query=...`
- Transforms API response to simplified format
- Returns standardized nutrition data per 100g

## Database Schema

### Users Table
- `id` (varchar, primary key) - User ID from Replit Auth
- `email` (varchar, unique)
- `firstName`, `lastName` (varchar)
- `profileImageUrl` (varchar)
- `createdAt`, `updatedAt` (timestamp)

### Meals Table
- `id` (varchar, primary key)
- `userId` (varchar, foreign key → users.id)
- `foodName` (text)
- `calories`, `protein`, `carbs`, `fat` (decimal)
- `mealType` (varchar) - breakfast/lunch/dinner/snack
- `date` (timestamp)
- `createdAt` (timestamp)

### Workouts Table
- `id` (varchar, primary key)
- `userId` (varchar, foreign key → users.id)
- `workoutType` (varchar) - run/strength/yoga/etc.
- `durationMinutes` (integer)
- `date` (timestamp)
- `notes` (text, optional)
- `createdAt` (timestamp)

### Sessions Table
- `sid` (varchar, primary key)
- `sess` (jsonb) - Session data
- `expire` (timestamp)

## API Endpoints

### Authentication
- `GET /api/login` - Initiate login flow
- `GET /api/logout` - Log out user
- `GET /api/callback` - OAuth callback
- `GET /api/auth/user` - Get current user (protected)

### Meals
- `GET /api/meals/:date?` - Get meals for date (protected)
- `POST /api/meals` - Create new meal (protected)

### Workouts
- `GET /api/workouts/:date?` - Get workouts for date (protected)
- `POST /api/workouts` - Create new workout (protected)

### Summaries
- `GET /api/summary/daily/:date?` - Get daily summary (protected)
- `GET /api/summary/weekly` - Get 7-day summary (protected)

### Food Search
- `GET /api/food/search?query=...` - Search Open Food Facts database (protected)

## Design System

FitBuddy follows a clean, data-focused design inspired by Linear and Material Design. See `design_guidelines.md` for complete details.

### Key Design Principles
- **Data-first**: Information hierarchy optimized for scanning
- **Efficiency**: Minimal friction in logging workflows
- **Clarity**: Clean layouts that showcase content
- **Mobile-optimized**: Touch-friendly, responsive design

### Typography
- **Primary**: Inter - UI text, forms, labels
- **Monospace**: JetBrains Mono - numerical data, metrics

### Color Scheme
- **Primary**: Fitness-themed green (HSL 142, 76%, 42%)
- **Neutral grays**: High contrast for readability
- **Semantic colors**: Success, warning, error states

## Future Enhancements

### Phase 2: Social & Accountability
- Friend connections
- Shared progress feeds
- Leaderboards
- Challenges and goals

### Phase 3: Coach Monitoring
- Coach dashboard for tracking multiple clients
- Progress reports and analytics
- Custom meal plans
- Workout program templates

### Phase 4: Advanced Features
- Custom nutrition goals (calorie targets, macro ratios)
- Meal and workout editing/deletion
- Photo uploads for meals
- Exercise library with instructions
- Integration with fitness trackers

## Learning Resources

This codebase is designed to be beginner-friendly and educational:

1. **Schema-First Development**: Start by defining data models in `shared/schema.ts`
2. **Type Safety**: TypeScript types flow from schema to frontend and backend
3. **Separation of Concerns**: Clear separation between UI, business logic, and data
4. **Modern React Patterns**: Hooks, form handling, server state management
5. **API Design**: RESTful endpoints with proper validation and error handling

## Contributing

To add a new feature:

1. **Define data model** in `shared/schema.ts` if needed
2. **Update storage layer** in `server/storage.ts` with CRUD methods
3. **Add API routes** in `server/routes.ts` with authentication
4. **Create UI components** in `client/src/components/`
5. **Add page/route** in `client/src/App.tsx` if needed
6. **Test the feature** end-to-end

## License

MIT License - feel free to use this project for learning and personal use.

## Support

For questions or issues, please check:
- Open Food Facts API documentation: https://world.openfoodfacts.org/data
- Replit Auth docs: https://docs.replit.com/
- Drizzle ORM docs: https://orm.drizzle.team/

---

Built with ❤️ for fitness enthusiasts and developers learning full-stack development.
