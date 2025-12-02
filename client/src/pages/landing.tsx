import { Button } from "@/components/ui/button";
import { Activity, Utensils, TrendingUp, Users } from "lucide-react";
import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                Track Your Fitness Journey with{" "}
                <span className="text-primary">FitBuddy</span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
                Log meals, track workouts, and visualize your progress with smart nutrition insights powered by USDA data
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="w-full sm:w-auto text-base px-8 py-6"
                onClick={() => setLocation("/login")}
                data-testid="button-get-started"
              >
                Get Started Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto text-base px-8 py-6"
                onClick={() => setLocation("/login")}
                data-testid="button-login"
              >
                Log In
              </Button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<Utensils className="w-8 h-8 text-primary" />}
              title="Meal Tracking"
              description="Log your meals with automatic nutrition lookup from USDA database"
            />
            <FeatureCard
              icon={<Activity className="w-8 h-8 text-primary" />}
              title="Workout Logging"
              description="Track your exercises, duration, and stay consistent with your routine"
            />
            <FeatureCard
              icon={<TrendingUp className="w-8 h-8 text-primary" />}
              title="Progress Charts"
              description="Visualize your calorie intake and workout trends over 7 days"
            />
            <FeatureCard
              icon={<Users className="w-8 h-8 text-primary" />}
              title="Ready to Grow"
              description="Built for future social features and coach monitoring"
            />
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-card py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            How FitBuddy Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              step="1"
              title="Log Your Meals"
              description="Search for foods using the USDA database or enter nutrition manually. Track breakfast, lunch, dinner, and snacks."
            />
            <StepCard
              step="2"
              title="Record Workouts"
              description="Log your workout type, duration, and optional notes. Build a consistent exercise habit."
            />
            <StepCard
              step="3"
              title="Track Progress"
              description="View daily summaries and 7-day trend charts for calories and workout minutes. Stay motivated!"
            />
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to Start Your Fitness Journey?
          </h2>
          <p className="text-xl text-muted-foreground">
            Join FitBuddy today and take control of your health and fitness goals
          </p>
          <Button
            size="lg"
            className="text-base px-8 py-6"
            onClick={() => setLocation("/login")}
            data-testid="button-cta-start"
          >
            Get Started Now
          </Button>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-lg border bg-card hover-elevate active-elevate-2" data-testid={`feature-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="space-y-4">
        <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="text-center space-y-4" data-testid={`step-card-${step}`}>
      <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto">
        {step}
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
