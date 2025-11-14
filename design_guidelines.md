# FitBuddy Design Guidelines

## Design Approach

**System Selected**: Material Design + Linear-inspired productivity patterns
**Rationale**: FitBuddy is a utility-focused, information-dense health tracking application where efficiency, clarity, and data visualization are paramount. The design prioritizes quick data entry, scannable metrics, and consistent patterns over visual creativity.

**Key Design Principles**:
- Data-first: Information hierarchy optimized for quick scanning and comprehension
- Efficiency: Minimize friction in logging meals and workouts
- Clarity: Clean layouts that don't compete with content
- Mobile-optimized: Touch-friendly targets, thumb-zone awareness

---

## Typography

**Font Families** (via Google Fonts CDN):
- Primary: 'Inter' - UI text, forms, data
- Accent: 'JetBrains Mono' - numerical data, calories, macros

**Type Scale**:
- Hero/Dashboard Headers: text-3xl md:text-4xl, font-bold
- Section Headers: text-xl md:text-2xl, font-semibold
- Metric Labels: text-sm, font-medium, uppercase tracking-wide
- Metric Values: text-2xl md:text-3xl, font-bold (JetBrains Mono)
- Body/Forms: text-base, font-normal
- Helper Text: text-sm, font-normal

---

## Layout System

**Spacing Primitives** (Tailwind units): 2, 4, 6, 8, 12, 16
- Component padding: p-4 to p-6
- Section spacing: space-y-8
- Card gaps: gap-4 to gap-6
- Form field spacing: space-y-4

**Container Strategy**:
- Max-width: max-w-6xl for dashboard
- Forms/modals: max-w-md to max-w-lg
- Full-width cards with inner padding

**Grid Patterns**:
- Mobile: Single column (grid-cols-1)
- Tablet: 2 columns for metrics (md:grid-cols-2)
- Desktop: 3-4 columns for stat cards (lg:grid-cols-3, xl:grid-cols-4)

---

## Component Library

### Navigation
- Top bar: Sticky header with logo, user menu, logout
- Mobile: Hamburger menu with slide-out drawer
- Height: h-16, shadow-sm

### Dashboard Cards
- Metric cards: Elevated cards (shadow-md) with icon, label, and large number
- Today's summary: Grid of 3-4 cards (calories, protein, carbs, workouts)
- Card structure: p-6, rounded-lg, with subtle border

### Forms
- Input fields: Full-width, h-12, px-4, rounded-md, border
- Labels: mb-2, text-sm, font-medium
- Form groups: space-y-4
- Buttons: Full-width on mobile, inline on desktop
- Quick-add forms: Compact, inline layout for rapid logging

### Data Display
- Meal/Workout Lists: Card-based with timestamp, type badge, and metrics
- List items: p-4, border-b, with hover state
- Time indicators: text-sm, positioned top-right
- Type badges: px-3 py-1, rounded-full, text-xs, font-medium

### Charts (Chart.js)
- 7-day line charts for calorie trends and workout minutes
- Canvas container: aspect-ratio-video or fixed height (h-64)
- Minimal gridlines, clear axis labels
- Responsive: scales down gracefully on mobile

### Buttons
- Primary CTA: px-6 py-3, rounded-md, font-semibold
- Secondary: Same sizing, border variant
- Icon buttons: h-10 w-10, rounded-full
- Touch targets: Minimum 44px height on mobile

### Authentication Pages
- Centered forms: max-w-md, mx-auto, mt-16
- Card container: p-8, shadow-lg, rounded-lg
- Social auth buttons (if using Replit Auth): Full-width, mb-4

---

## Page Structures

### Login/Register
- Centered card with form fields
- Logo/app name at top
- Toggle between login/register states
- Minimal distractions

### Dashboard (Main View)
- Header: Welcome message with today's date
- Metrics Row: 3-4 stat cards (calories in, protein, carbs, workout minutes)
- Quick Add Section: Two-column layout (md:) for "Add Meal" and "Add Workout" forms
- Today's Log: Tabbed or sectioned view showing meal list and workout list
- Weekly Chart Section: Chart.js visualization below the fold

### Food Search Modal (Nutrition API)
- Overlay modal: max-w-2xl
- Search input at top with instant results
- Results list: Scrollable, max-h-96
- Each result: Food name, serving size, calories preview
- Select action: Pre-fills main meal form

---

## Interaction Patterns

**Data Entry Flow**:
1. Click "Add Meal" or "Add Workout"
2. Form expands or modal opens
3. Search food (optional nutrition API lookup)
4. Fill remaining fields
5. Submit → Updates today's summary immediately

**Feedback**:
- Form validation: Inline error messages (text-sm, text-red-600)
- Success states: Brief toast notification (top-right, auto-dismiss)
- Loading states: Spinner for API calls, skeleton screens for charts

**Animations**: Minimal
- Modal entrance: Simple fade-in (150ms)
- List item additions: Subtle slide-in
- No scroll-triggered animations

---

## Accessibility

- Semantic HTML: `<main>`, `<nav>`, `<form>`, `<button>`
- ARIA labels on icon-only buttons
- Focus states: Clear outline (ring-2 ring-offset-2)
- Keyboard navigation: Full form and modal support
- Contrast: WCAG AA minimum for all text

---

## Images

**Usage**: Minimal - this is a data-centric app
- **No hero image**: Dashboard prioritizes immediate data visibility
- Authentication pages: Optional subtle background pattern (low opacity)
- Empty states: Simple illustrations for "no meals logged yet"
- Profile/avatar: User initials in circular container (h-10 w-10)

---

## Mobile Optimization

- Stack all grid layouts to single column on mobile
- Sticky "Add" floating action button (bottom-right) for quick logging
- Thumb-zone placement: Primary actions in bottom half
- Form inputs: Large enough for touch (min h-12)
- Charts: Simplified axes, larger touch targets for tooltips