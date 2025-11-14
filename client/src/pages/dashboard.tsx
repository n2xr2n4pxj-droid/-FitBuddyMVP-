import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Activity, Utensils, Flame, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import type { DailySummary, Meal, Workout } from "@shared/schema";
import { MealForm } from "@/components/meal-form";
import { WorkoutForm } from "@/components/workout-form";
import { MealList } from "@/components/meal-list";
import { WorkoutList } from "@/components/workout-list";
import { WeeklyChart } from "@/components/weekly-chart";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Dashboard() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: todaySummary, isLoading: summaryLoading } = useQuery<DailySummary>({
    queryKey: ["/api/summary/daily", today],
    enabled: isAuthenticated,
  });

  const { data: meals = [], isLoading: mealsLoading } = useQuery<Meal[]>({
    queryKey: ["/api/meals", today],
    enabled: isAuthenticated,
  });

  const { data: workouts = [], isLoading: workoutsLoading } = useQuery<Workout[]>({
    queryKey: ["/api/workouts", today],
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return <DashboardSkeleton />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-primary" data-testid="text-app-name">FitBuddy</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
                  <AvatarFallback>
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="text-sm">
                  <p className="font-medium" data-testid="text-user-name">
                    {user?.firstName || user?.email}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.location.href = "/api/logout"}
                data-testid="button-logout"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="space-y-2">
          <h2 className="text-3xl md:text-4xl font-bold">
            Welcome back, {user?.firstName || "there"}!
          </h2>
          <p className="text-lg text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        {/* Today's Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={<Flame className="w-5 h-5" />}
            label="Calories"
            value={summaryLoading ? "..." : Math.round(todaySummary?.totalCalories || 0)}
            unit="kcal"
            testId="metric-calories"
          />
          <MetricCard
            icon={<Activity className="w-5 h-5" />}
            label="Protein"
            value={summaryLoading ? "..." : Math.round(todaySummary?.totalProtein || 0)}
            unit="g"
            testId="metric-protein"
          />
          <MetricCard
            icon={<Utensils className="w-5 h-5" />}
            label="Meals"
            value={summaryLoading ? "..." : todaySummary?.mealCount || 0}
            unit="logged"
            testId="metric-meals"
          />
          <MetricCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Workouts"
            value={summaryLoading ? "..." : todaySummary?.totalWorkoutMinutes || 0}
            unit="min"
            testId="metric-workouts"
          />
        </div>

        {/* Quick Add Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Add Meal</h3>
            <MealForm />
          </Card>
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Add Workout</h3>
            <WorkoutForm />
          </Card>
        </div>

        {/* Today's Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Today's Meals</h3>
            {mealsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <MealList meals={meals} />
            )}
          </Card>
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Today's Workouts</h3>
            {workoutsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <WorkoutList workouts={workouts} />
            )}
          </Card>
        </div>

        {/* Weekly Charts */}
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-6">7-Day Trends</h3>
          <WeeklyChart />
        </Card>
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value, unit, testId }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  unit: string;
  testId: string;
}) {
  return (
    <Card className="p-6 space-y-3" data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className="text-primary">{icon}</div>
      </div>
      <div className="space-y-1">
        <div className="text-3xl font-bold font-mono" data-testid={`${testId}-value`}>{value}</div>
        <div className="text-sm text-muted-foreground">{unit}</div>
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </main>
    </div>
  );
}
